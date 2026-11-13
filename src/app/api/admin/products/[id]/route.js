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

    // Fetch product images and variants
    const [images, variants] = await Promise.all([
      sql`SELECT * FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC, id ASC`,
      sql`SELECT * FROM product_variants WHERE product_id = ${id} ORDER BY sort_order ASC, id ASC`,
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

    if (setClauses.length === 0 && body.images === undefined && body.variants === undefined) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    let product;
    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      const products = await sql(query, values);
      product = products[0];
    } else {
      const existing = await sql`SELECT * FROM products WHERE id = ${id}`;
      product = existing[0];
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

    // Handle package size / weight variants update
    if (body.variants !== undefined && Array.isArray(body.variants)) {
      await sql`DELETE FROM product_variants WHERE product_id = ${id}`;
      let totalVariantStock = 0;
      for (let i = 0; i < body.variants.length; i++) {
        const v = body.variants[i];
        const label = String(v?.label || "").trim();
        const price = parseFloat(v?.price || 0);
        const stock = Math.max(0, parseInt(v?.stock_quantity || 0, 10) || 0);
        if (!label || !Number.isFinite(price) || price <= 0) continue;
        totalVariantStock += stock;
        await sql`
          INSERT INTO product_variants (
            product_id, label, price, compare_price, stock_quantity, sku, is_active, sort_order
          ) VALUES (
            ${id}, ${label}, ${price},
            ${v.compare_price ? parseFloat(v.compare_price) : null},
            ${stock}, ${v.sku ? String(v.sku).trim() : null}, ${v.is_active !== false}, ${i}
          )
        `;
      }
      if (body.variants.length > 0) {
        await sql`UPDATE products SET stock_quantity = ${totalVariantStock}, updated_at = NOW() WHERE id = ${id}`;
        product.stock_quantity = totalVariantStock;
      }
    }

    return Response.json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    return Response.json(
      { error: "Failed to update product" },
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
