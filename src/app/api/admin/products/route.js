import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const lowStock = searchParams.get("low_stock") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.name as category_name, sc.name as sub_category_name,
        (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_default = true LIMIT 1) as default_image
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (LOWER(p.name) LIKE LOWER($${paramIndex}) OR LOWER(p.brand) LIKE LOWER($${paramIndex}) OR LOWER(p.description) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(parseInt(category, 10));
      paramIndex++;
    }

    if (status === "active") {
      query += ` AND p.is_active = true`;
    } else if (status === "inactive") {
      query += ` AND p.is_active = false`;
    }

    if (lowStock) {
      query += ` AND p.stock_quantity <= 5`;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*)::int as total FROM (${query}) AS filtered_tbl`;
    const countRes = await sql(countQuery, params);
    const totalCount = countRes[0]?.total || 0;

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const products = await sql(query, params);

    const enrichedProducts = products.map((p) => ({
      ...p,
      thumbnail_url: p.default_image || p.image_url,
    }));

    return Response.json({
      products: enrichedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching admin products:", error);
    return Response.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const {
      name,
      slug,
      description,
      price,
      compare_price,
      sale_price,
      image_url,
      category_id,
      sub_category_id,
      stock_quantity,
      brand,
      weight,
      requires_prescription,
      is_active,
      images,
      variants,
    } = body;

    const trimmedName = sanitizeText(name, 255);
    const cleanSlug = sanitizeText(slug, 255)
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const parsedPrice = parseFloat(price);
    const parsedCatId = parseInt(category_id, 10);
    const parsedStock = parseInt(stock_quantity || 0, 10);

    if (!trimmedName || !cleanSlug || isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedCatId)) {
      return Response.json(
        { error: "Valid name, slug, positive price, and category are required." },
        { status: 400 }
      );
    }

    const products = await sql`
      INSERT INTO products (
        name, slug, description, price, compare_price, sale_price,
        image_url, category_id, sub_category_id, stock_quantity,
        brand, weight, requires_prescription, is_active
      )
      VALUES (
        ${trimmedName}, ${cleanSlug}, ${description || null}, ${parsedPrice},
        ${compare_price ? parseFloat(compare_price) : null},
        ${sale_price ? parseFloat(sale_price) : null},
        ${image_url || null}, ${parsedCatId},
        ${sub_category_id ? parseInt(sub_category_id, 10) : null},
        ${parsedStock >= 0 ? parsedStock : 0},
        ${brand ? sanitizeText(brand, 100) : null},
        ${weight ? sanitizeText(weight, 50) : null},
        ${Boolean(requires_prescription)},
        ${is_active !== undefined ? Boolean(is_active) : true}
      )
      RETURNING *
    `;

    const product = products[0];

    // Insert package variants if provided
    if (Array.isArray(variants) && variants.length > 0) {
      let totalVariantStock = 0;
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const label = String(v?.label || "").trim();
        const vPrice = parseFloat(v?.price || 0);
        const vStock = Math.max(0, parseInt(v?.stock_quantity || 0, 10) || 0);
        if (!label || !Number.isFinite(vPrice) || vPrice <= 0) continue;
        totalVariantStock += vStock;
        await sql`
          INSERT INTO product_variants (
            product_id, label, price, compare_price, stock_quantity, sku, is_active, sort_order
          ) VALUES (
            ${product.id}, ${label}, ${vPrice},
            ${v.compare_price ? parseFloat(v.compare_price) : null},
            ${vStock}, ${v.sku ? String(v.sku).trim() : null}, ${v.is_active !== false}, ${i}
          )
        `;
      }
      if (totalVariantStock > 0) {
        await sql`UPDATE products SET stock_quantity = ${totalVariantStock} WHERE id = ${product.id}`;
        product.stock_quantity = totalVariantStock;
      }
    }

    // Insert product images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img?.url) {
          await sql`
            INSERT INTO product_images (product_id, image_url, is_default, sort_order)
            VALUES (${product.id}, ${img.url}, ${i === 0}, ${i})
          `;
        }
      }
      if (images[0]?.url) {
        await sql`UPDATE products SET image_url = ${images[0].url} WHERE id = ${product.id}`;
        product.image_url = images[0].url;
      }
    }

    return Response.json({ product });
  } catch (error) {
    console.error("Error creating product:", error);
    return Response.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
