import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const offerId = parseInt(params?.id, 10);
    if (!Number.isInteger(offerId) || offerId <= 0) {
      return Response.json({ error: "Invalid offer ID" }, { status: 400 });
    }

    const existing = await sql`SELECT * FROM offers WHERE id = ${offerId} LIMIT 1`;
    if (!existing || existing.length === 0) {
      return Response.json({ error: "Offer not found" }, { status: 404 });
    }

    const cur = existing[0];
    const body = await request.json();

    const status = ["active", "paused", "expired"].includes(body.status) ? body.status : cur.status;
    const title = body.title !== undefined ? sanitizeText(body.title, 160) : cur.title;
    const description =
      body.description !== undefined ? sanitizeText(body.description, 500) : cur.description;
    const discountValue =
      body.discount_value !== undefined ? parseFloat(body.discount_value) : cur.discount_value;
    const startDate =
      body.start_date !== undefined ? (body.start_date ? new Date(body.start_date) : null) : cur.start_date;
    const endDate =
      body.end_date !== undefined ? (body.end_date ? new Date(body.end_date) : null) : cur.end_date;

    const updated = await sql`
      UPDATE offers
      SET
        title = ${title},
        description = ${description},
        discount_value = ${discountValue},
        start_date = ${startDate},
        end_date = ${endDate},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${offerId}
      RETURNING *
    `;

    return Response.json({ offer: updated[0] });
  } catch (error) {
    console.error("Error updating offer:", error);
    return Response.json({ error: "Failed to update offer" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const offerId = parseInt(params?.id, 10);
    await sql`DELETE FROM offers WHERE id = ${offerId}`;
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting offer:", error);
    return Response.json({ error: "Failed to delete offer" }, { status: 500 });
  }
}

