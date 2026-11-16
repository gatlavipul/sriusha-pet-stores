import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

export async function POST(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const guestItems = Array.isArray(body?.items) ? body.items : [];

    for (const item of guestItems) {
      const productId = parseInt(item.product_id || item.id, 10);
      const variantId = item.variant_id ? parseInt(item.variant_id, 10) : null;
      const variantName = item.variant_name || null;
      const guestQty = Math.max(1, parseInt(item.quantity, 10) || 1);

      if (isNaN(productId) || productId <= 0) continue;

      // Verify product exists and check stock
      const products = await sql`
        SELECT p.id, p.stock_quantity, pv.stock_quantity as var_stock, pv.needs_review as var_needs_review
        FROM products p
        LEFT JOIN product_variants pv ON pv.id = ${variantId}
        WHERE p.id = ${productId}
        LIMIT 1
      `;
      if (products.length === 0) continue;
      if (variantId && products[0].var_needs_review) continue;

      const product = products[0];
      const maxStock = Math.max(
        1,
        variantId && product.var_stock !== null ? product.var_stock : (product.stock_quantity ?? 99)
      );

      // Check if item already exists in user's cart (matching variant)
      const existing = await sql`
        SELECT id, quantity 
        FROM cart_items 
        WHERE user_id = ${userId} 
          AND product_id = ${productId}
          AND (variant_id = ${variantId} OR (variant_id IS NULL AND ${variantId} IS NULL))
        LIMIT 1
      `;

      if (existing.length > 0) {
        // Merge quantities safely without exceeding available stock
        const mergedQty = Math.min(existing[0].quantity + guestQty, maxStock);
        await sql`
          UPDATE cart_items 
          SET quantity = ${mergedQty}, updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        // Insert new item capped by stock
        const finalQty = Math.min(guestQty, maxStock);
        await sql`
          INSERT INTO cart_items (user_id, product_id, quantity, variant_id, variant_name)
          VALUES (${userId}, ${productId}, ${finalQty}, ${variantId}, ${variantName})
        `;
      }
    }

    // Return the full updated merged cart with prices and variants
    const cartItems = await sql`
      SELECT 
        c.*, 
        p.name, 
        COALESCE(pv.price, p.sale_price, p.price) as price,
        COALESCE(pv.compare_price, p.compare_price) as compare_price,
        p.image_url, 
        COALESCE(pv.stock_quantity, p.stock_quantity) as stock_quantity,
        p.requires_prescription,
        COALESCE(pv.label, c.variant_name) as variant_name
      FROM cart_items c 
      JOIN products p ON c.product_id = p.id 
      LEFT JOIN product_variants pv ON c.variant_id = pv.id
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
    `;

    return Response.json({
      success: true,
      message: "Cart merged successfully",
      cartItems,
    });
  } catch (error) {
    console.error("Error in cart merge:", error);
    return Response.json({ error: "Failed to merge cart items" }, { status: 500 });
  }
}
