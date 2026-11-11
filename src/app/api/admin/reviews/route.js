import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = `
      SELECT r.*, p.name as product_name, p.slug as product_slug, p.image_url as product_image
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      query += ` AND r.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY r.created_at DESC`;

    const reviews = await sql(query, params);
    return Response.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews for moderation:", error);
    return Response.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !["approved", "rejected", "pending"].includes(status)) {
      return Response.json({ error: "Valid id and status are required" }, { status: 400 });
    }

    await sql`UPDATE product_reviews SET status = ${status} WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating review:", error);
    return Response.json({ error: "Failed to update review" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Review ID required" }, { status: 400 });
    }

    await sql`DELETE FROM product_reviews WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting review:", error);
    return Response.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
