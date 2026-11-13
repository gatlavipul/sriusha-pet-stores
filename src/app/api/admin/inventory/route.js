import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";
import { recordStockMovement } from "@/utils/stockService";
import { checkAndTriggerLowStock } from "@/utils/notificationService";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get("low_stock") === "true";

    const [products, variants, movements] = await Promise.all([
      sql`
        SELECT p.id, p.name, p.slug, p.price, p.stock_quantity, p.weight, p.is_active, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.stock_quantity ASC, p.id DESC
      `,
      sql`
        SELECT id, product_id, label, price, compare_price, stock_quantity, sku, is_active
        FROM product_variants
        ORDER BY sort_order ASC, id ASC
      `,
      sql`
        SELECT *
        FROM stock_movements
        ORDER BY created_at DESC
        LIMIT 80
      `,
    ]);

    const varMap = new Map();
    for (const v of variants || []) {
      if (!varMap.has(v.product_id)) varMap.set(v.product_id, []);
      varMap.get(v.product_id).push(v);
    }

    let items = (products || []).map((p) => ({
      ...p,
      variants: varMap.get(p.id) || [],
    }));

    if (lowStockOnly) {
      items = items.filter(
        (p) =>
          p.stock_quantity <= 5 ||
          p.variants.some((v) => v.stock_quantity <= 5)
      );
    }

    return Response.json({
      items,
      movements: movements || [],
    });
  } catch (error) {
    console.error("Error fetching admin inventory:", error);
    return Response.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const productId = parseInt(body.product_id, 10);
    const variantId = body.variant_id ? parseInt(body.variant_id, 10) : null;
    const newStockRaw = parseInt(body.new_stock, 10);
    const reason = sanitizeText(body.reason || "admin_adjustment", 60);
    const notes = sanitizeText(body.notes || "", 300);

    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: "Valid product_id is required" }, { status: 400 });
    }
    if (!Number.isInteger(newStockRaw) || newStockRaw < 0) {
      return Response.json({ error: "Stock quantity must be 0 or greater" }, { status: 400 });
    }

    if (variantId) {
      const prevRows = await sql`
        SELECT v.stock_quantity, v.label, p.name as product_name
        FROM product_variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.id = ${variantId} AND v.product_id = ${productId}
        LIMIT 1
      `;
      if (!prevRows || prevRows.length === 0) {
        return Response.json({ error: "Variant not found" }, { status: 404 });
      }
      const prev = prevRows[0];
      const delta = newStockRaw - prev.stock_quantity;

      await sql`
        UPDATE product_variants
        SET stock_quantity = ${newStockRaw}, updated_at = NOW()
        WHERE id = ${variantId}
      `;

      // Sync parent total stock across active variants
      await sql`
        UPDATE products
        SET stock_quantity = COALESCE((SELECT SUM(stock_quantity)::int FROM product_variants WHERE product_id = ${productId} AND is_active = TRUE), ${newStockRaw}),
            updated_at = NOW()
        WHERE id = ${productId}
      `;

      await recordStockMovement({
        productId,
        variantId,
        productName: prev.product_name,
        variantLabel: prev.label,
        changeAmount: delta,
        previousStock: prev.stock_quantity,
        newStock: newStockRaw,
        reason,
        notes: notes || `Manual stock update (${prev.label})`,
        userId: authResult.user.id,
        userName: authResult.user.name || authResult.user.email,
      });

      return Response.json({ success: true, new_stock: newStockRaw });
    }

    const prevRows = await sql`
      SELECT id, name, stock_quantity FROM products WHERE id = ${productId} LIMIT 1
    `;
    if (!prevRows || prevRows.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    const prev = prevRows[0];
    const delta = newStockRaw - prev.stock_quantity;

    await sql`
      UPDATE products
      SET stock_quantity = ${newStockRaw}, updated_at = NOW()
      WHERE id = ${productId}
    `;

    await recordStockMovement({
      productId,
      productName: prev.name,
      changeAmount: delta,
      previousStock: prev.stock_quantity,
      newStock: newStockRaw,
      reason,
      notes: notes || "Manual stock update",
      userId: authResult.user.id,
      userName: authResult.user.name || authResult.user.email,
    });

    if (newStockRaw <= 5) {
      await checkAndTriggerLowStock(productId);
    }

    return Response.json({ success: true, new_stock: newStockRaw });
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return Response.json({ error: "Failed to update stock" }, { status: 500 });
  }
}

