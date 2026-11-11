import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const categories = await sql`
      SELECT c.*, COUNT(p.id)::int as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;

    return Response.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return Response.json(
      { error: "Failed to fetch categories" },
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
    const { name, slug, description, image_url } = body;

    const trimmedName = sanitizeText(name, 100);
    const cleanSlug = sanitizeText(slug, 100)
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!trimmedName || !cleanSlug) {
      return Response.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    const categories = await sql`
      INSERT INTO categories (name, slug, description, image_url)
      VALUES (${trimmedName}, ${cleanSlug}, ${description ? sanitizeText(description, 500) : null}, ${image_url || null})
      RETURNING *
    `;

    return Response.json({ category: categories[0] });
  } catch (error) {
    console.error("Error creating category:", error);
    return Response.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
