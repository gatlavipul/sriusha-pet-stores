import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");

    let query = "SELECT * FROM sub_categories";
    const params = [];
    let paramIndex = 1;

    if (categoryId) {
      query += ` WHERE category_id = $${paramIndex}`;
      params.push(parseInt(categoryId, 10));
      paramIndex++;
    }

    query += " ORDER BY name ASC";

    const subCategories = await sql(query, params);
    return Response.json({ subCategories });
  } catch (error) {
    console.error("Error fetching sub-categories:", error);
    return Response.json(
      { error: "Failed to fetch sub-categories" },
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
    const { name, slug, category_id } = body;

    const trimmedName = sanitizeText(name, 100);
    const cleanSlug = sanitizeText(slug, 100)
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const parsedCatId = parseInt(category_id, 10);

    if (!trimmedName || !cleanSlug || isNaN(parsedCatId)) {
      return Response.json(
        { error: "Name, slug, and category_id are required" },
        { status: 400 }
      );
    }

    const subCategories = await sql`
      INSERT INTO sub_categories (name, slug, category_id)
      VALUES (${trimmedName}, ${cleanSlug}, ${parsedCatId})
      RETURNING *
    `;

    return Response.json({ subCategory: subCategories[0] });
  } catch (error) {
    console.error("Error creating sub-category:", error);
    return Response.json(
      { error: "Failed to create sub-category" },
      { status: 500 }
    );
  }
}
