import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { slug } = params;
    const products = await sql`
      SELECT p.*, c.name as category_name, c.slug as category_slug 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.slug = ${slug} AND p.is_active = true
      LIMIT 1
    `;

    if (products.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const product = products[0];
    const [images, variants] = await Promise.all([
      sql`SELECT id, image_url, is_default, sort_order FROM product_images WHERE product_id = ${product.id} ORDER BY sort_order ASC, id ASC`,
      sql`SELECT id, product_id, label, price, compare_price, stock_quantity, sku, is_active FROM product_variants WHERE product_id = ${product.id} AND is_active = TRUE ORDER BY sort_order ASC, id ASC`,
    ]);

    return Response.json({ product: { ...product, images: images || [], variants: variants || [] } });
  } catch (error) {
    console.error("Error fetching product:", error);
    return Response.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
