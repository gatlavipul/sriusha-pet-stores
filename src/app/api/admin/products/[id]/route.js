import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const products = await sql`
      SELECT p.*, c.name as category_name, sc.name as sub_category_name
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
      WHERE p.id = ${id} LIMIT 1
    `;

    if (products.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    // Fetch product images and variants with full admin fields
    const [images, variants] = await Promise.all([
      sql`SELECT * FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC, id ASC`,
      sql`
        SELECT id, product_id, label, sku, price, compare_price, stock_quantity,
               COALESCE(reorder_level, 5) as reorder_level, is_active, needs_review, sort_order
        FROM product_variants
        WHERE product_id = ${id}
        ORDER BY sort_order ASC, id ASC
      `,
    ]);

    const product = { ...products[0], images, variants };
    return Response.json({ product });
  } catch (error) {
    console.error("Error fetching product:", error);
    return Response.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const body = await request.json();

    const existingList = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
    if (existingList.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    const existing = existingList[0];

    // Server Rule: Validate product MRP (compare_price >= price or empty/null)
    const effectivePrice = body.price !== undefined ? parseFloat(body.price) : parseFloat(existing.price);
    const effectiveComparePrice =
      body.compare_price !== undefined
        ? body.compare_price === null || body.compare_price === ""
          ? null
          : parseFloat(body.compare_price)
        : existing.compare_price
        ? parseFloat(existing.compare_price)
        : null;

    if (effectiveComparePrice !== null && !isNaN(effectiveComparePrice) && effectiveComparePrice < effectivePrice) {
      return Response.json(
        { error: "Product MRP (compare price) cannot be lower than selling price." },
        { status: 400 }
      );
    }

    // Validate base product stock if provided
    if (body.stock_quantity !== undefined) {
      const parsedStock = parseInt(body.stock_quantity, 10);
      if (isNaN(parsedStock) || parsedStock < 0) {
        return Response.json({ error: "Product stock cannot be negative." }, { status: 400 });
      }
    }

    // Server Rule: Validate variants before making any modifications
    if (body.variants !== undefined && Array.isArray(body.variants)) {
      for (const v of body.variants) {
        const vLabel = String(v?.label || "").trim();
        const vPrice = parseFloat(v?.price || 0);
        const vStock = parseInt(v?.stock_quantity ?? 0, 10);
        if (!vLabel) {
          return Response.json({ error: "Variant label cannot be empty." }, { status: 400 });
        }
        if (isNaN(vPrice) || vPrice <= 0) {
          return Response.json(
            { error: `Variant "${vLabel}" price must be greater than 0.` },
            { status: 400 }
          );
        }
        if (isNaN(vStock) || vStock < 0) {
          return Response.json(
            { error: `Variant "${vLabel}" stock cannot be negative.` },
            { status: 400 }
          );
        }
        if (v.compare_price !== undefined && v.compare_price !== null && v.compare_price !== "") {
          const vCompare = parseFloat(v.compare_price);
          if (!isNaN(vCompare) && vCompare < vPrice) {
            return Response.json(
              { error: `Variant "${vLabel}" MRP cannot be lower than selling price.` },
              { status: 400 }
            );
          }
        }
      }
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      "name",
      "slug",
      "description",
      "price",
      "compare_price",
      "sale_price",
      "image_url",
      "category_id",
      "sub_category_id",
      "stock_quantity",
      "is_active",
      "brand",
      "weight",
      "requires_prescription",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    let product = existing;
    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      const products = await sql(query, values);
      product = products[0];

      // Track stock movement for base product if stock changed and product has no reviewed variants
      if (body.stock_quantity !== undefined) {
        const oldStock = Number(existing.stock_quantity);
        const newStock = Number(product.stock_quantity);
        if (oldStock !== newStock) {
          await sql`
            INSERT INTO stock_movements (
              product_id, variant_id, product_name, variant_label, change_amount,
              previous_stock, new_stock, reason, notes, performed_by_user_id, created_at
            ) VALUES (
              ${id}, NULL, ${product.name}, NULL, ${newStock - oldStock},
              ${oldStock}, ${newStock}, 'admin_inventory_adjustment',
              'Admin base product stock adjustment', ${authResult.user?.id || null}, NOW()
            )
          `;
        }
      }
    }

    // Handle image updates
    if (body.images !== undefined && Array.isArray(body.images)) {
      await sql`DELETE FROM product_images WHERE product_id = ${id}`;

      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img?.url) {
          await sql`
            INSERT INTO product_images (product_id, image_url, is_default, sort_order)
            VALUES (${id}, ${img.url}, ${i === 0}, ${i})
          `;
        }
      }

      if (body.images.length > 0 && body.images[0]?.url) {
        await sql`UPDATE products SET image_url = ${body.images[0].url} WHERE id = ${id}`;
        product.image_url = body.images[0].url;
      }
    }

    // Handle package size / weight variants update with safety rules:
    // - Saving a variant sets needs_review = false
    // - Changes in stock write stock_movements rows with admin user id
    if (body.variants !== undefined && Array.isArray(body.variants)) {
      const existingVariants = await sql`
        SELECT id, product_id, label, sku, price, compare_price, stock_quantity, reorder_level, is_active, needs_review
        FROM product_variants
        WHERE product_id = ${id}
      `;
      const existingVarMap = new Map(existingVariants.map((v) => [Number(v.id), v]));
      const submittedIds = new Set();

      for (let i = 0; i < body.variants.length; i++) {
        const v = body.variants[i];
        const vLabel = String(v?.label || "").trim();
        const vPrice = parseFloat(v?.price || 0);
        const vStock = Math.max(0, parseInt(v?.stock_quantity ?? 0, 10));
        const vCompare =
          v?.compare_price !== undefined && v?.compare_price !== null && v?.compare_price !== ""
            ? parseFloat(v.compare_price)
            : null;
        const vSku = v?.sku ? String(v.sku).trim() : null;
        const vReorder = v?.reorder_level !== undefined ? Math.max(0, parseInt(v.reorder_level, 10)) : 5;
        const vActive = v?.is_active !== false;

        const vId = v?.id ? Number(v.id) : null;
        if (vId && existingVarMap.has(vId)) {
          submittedIds.add(vId);
          const oldVar = existingVarMap.get(vId);
          const oldStock = Number(oldVar.stock_quantity);

          if (oldStock !== vStock) {
            await sql`
              INSERT INTO stock_movements (
                product_id, variant_id, product_name, variant_label, change_amount,
                previous_stock, new_stock, reason, notes, performed_by_user_id, created_at
              ) VALUES (
                ${id}, ${vId}, ${product.name}, ${vLabel}, ${vStock - oldStock},
                ${oldStock}, ${vStock}, 'admin_inventory_adjustment',
                'Admin variant stock adjustment', ${authResult.user?.id || null}, NOW()
              )
            `;
          }

          await sql`
            UPDATE product_variants
            SET label = ${vLabel},
                sku = ${vSku},
                price = ${vPrice},
                compare_price = ${vCompare},
                stock_quantity = ${vStock},
                reorder_level = ${vReorder},
                is_active = ${vActive},
                needs_review = false,
                sort_order = ${i},
                updated_at = NOW()
            WHERE id = ${vId} AND product_id = ${id}
          `;
        } else {
          // New variant inserted by admin: sets needs_review = false
          const inserted = await sql`
            INSERT INTO product_variants (
              product_id, label, sku, price, compare_price, stock_quantity,
              reorder_level, is_active, needs_review, sort_order
            ) VALUES (
              ${id}, ${vLabel}, ${vSku}, ${vPrice}, ${vCompare}, ${vStock},
              ${vReorder}, ${vActive}, false, ${i}
            ) RETURNING id
          `;
          const newVarId = inserted[0]?.id;
          if (newVarId) {
            submittedIds.add(newVarId);
            if (vStock > 0) {
              await sql`
                INSERT INTO stock_movements (
                  product_id, variant_id, product_name, variant_label, change_amount,
                  previous_stock, new_stock, reason, notes, performed_by_user_id, created_at
                ) VALUES (
                  ${id}, ${newVarId}, ${product.name}, ${vLabel}, ${vStock},
                  0, ${vStock}, 'admin_inventory_adjustment',
                  'Initial stock on variant creation', ${authResult.user?.id || null}, NOW()
                )
              `;
            }
          }
        }
      }

      // Deactivate any existing variants that were removed from the form
      for (const oldVar of existingVariants) {
        if (!submittedIds.has(Number(oldVar.id))) {
          await sql`UPDATE product_variants SET is_active = false, updated_at = NOW() WHERE id = ${oldVar.id}`;
        }
      }

      // Rule 3: Synchronize parent product stock to sum of reviewed active variants
      const reviewedStats = await sql`
        SELECT COALESCE(SUM(stock_quantity)::int, 0) as total, COUNT(*)::int as count
        FROM product_variants
        WHERE product_id = ${id} AND is_active = TRUE AND needs_review = FALSE
      `;
      if (reviewedStats[0].count > 0) {
        const syncedStock = reviewedStats[0].total;
        await sql`UPDATE products SET stock_quantity = ${syncedStock}, updated_at = NOW() WHERE id = ${id}`;
        product.stock_quantity = syncedStock;
      }
    }

    // Fetch updated variants and images to return
    const [images, variants] = await Promise.all([
      sql`SELECT * FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC, id ASC`,
      sql`
        SELECT id, product_id, label, sku, price, compare_price, stock_quantity,
               COALESCE(reorder_level, 5) as reorder_level, is_active, needs_review, sort_order
        FROM product_variants
        WHERE product_id = ${id}
        ORDER BY sort_order ASC, id ASC
      `,
    ]);

    return Response.json({ product: { ...product, images, variants } });
  } catch (error) {
    console.error("Error updating product:", error);
    return Response.json(
      { error: error?.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    await sql`DELETE FROM product_images WHERE product_id = ${id}`;
    await sql`DELETE FROM products WHERE id = ${id}`;

    return Response.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return Response.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
