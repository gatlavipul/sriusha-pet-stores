import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const categoryId = searchParams.get("category_id");
    const search = searchParams.get("search");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    let query =
      "SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = true";
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND c.slug = $${paramIndex}`;
      params.push(category.toLowerCase().trim());
      paramIndex++;
    }

    if (categoryId) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(parseInt(categoryId, 10));
      paramIndex++;
    }

    if (search) {
      query += ` AND (LOWER(p.name) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(p.brand, '')) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(p.description, '')) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const products = await sql(query, params);

    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      const variants = await sql`
        SELECT id, product_id, label, price, compare_price, stock_quantity, sku, sort_order
        FROM product_variants
        WHERE product_id = ANY(${productIds}) AND is_active = true AND needs_review = false
        ORDER BY sort_order ASC, id ASC
      `;
      const byProduct = new Map();
      for (const v of variants) {
        if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
        byProduct.get(v.product_id).push(v);
      }
      for (const p of products) {
        p.variants = byProduct.get(p.id) || [];
      }
    }

    return Response.json(
      { products },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching products:", error);
    return Response.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
