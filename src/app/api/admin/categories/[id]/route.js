import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

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

    const allowedFields = ["name", "slug", "description", "image_url"];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(field === "description" ? sanitizeText(body[field], 500) : sanitizeText(body[field], 100));
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `UPDATE categories SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const categories = await sql(query, values);

    if (categories.length === 0) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json({ category: categories[0] });
  } catch (error) {
    console.error("Error updating category:", error);
    return Response.json(
      { error: "Failed to update category" },
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

    // Check if category has products
    const prods = await sql`SELECT COUNT(*)::int as count FROM products WHERE category_id = ${id}`;
    if (prods[0]?.count > 0) {
      return Response.json(
        { error: `Cannot delete category: ${prods[0].count} product(s) are assigned to it. Reassign or delete the products first.` },
        { status: 400 }
      );
    }

    await sql`DELETE FROM categories WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return Response.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
