import sql from "@/app/api/utils/sql";
import { requireUser, sanitizeText } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const petId = searchParams.get("pet_id") ? parseInt(searchParams.get("pet_id"), 10) : null;

    const rows = petId
      ? await sql`
          SELECT r.*, p.name as pet_name,
            CASE WHEN r.next_due_date IS NOT NULL THEN (r.next_due_date - CURRENT_DATE) ELSE NULL END as days_until_due
          FROM pet_health_records r
          JOIN pets p ON p.id = r.pet_id
          WHERE r.user_id = ${authResult.user.id} AND r.pet_id = ${petId}
          ORDER BY COALESCE(r.next_due_date, r.record_date) ASC
        `
      : await sql`
          SELECT r.*, p.name as pet_name,
            CASE WHEN r.next_due_date IS NOT NULL THEN (r.next_due_date - CURRENT_DATE) ELSE NULL END as days_until_due
          FROM pet_health_records r
          JOIN pets p ON p.id = r.pet_id
          WHERE r.user_id = ${authResult.user.id}
          ORDER BY COALESCE(r.next_due_date, r.record_date) ASC
        `;

    return Response.json({ records: rows || [] });
  } catch (error) {
    console.error("Error fetching pet health records:", error);
    return Response.json({ error: "Failed to load pet health records" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const petId = parseInt(body.pet_id, 10);
    const recordType = ["vaccination", "deworming", "vet_visit"].includes(body.record_type)
      ? body.record_type
      : "vaccination";
    const title = sanitizeText(body.title || "", 160);
    const recordDate = body.record_date || new Date().toISOString().slice(0, 10);
    const nextDueDate = body.next_due_date || null;
    const clinicName = sanitizeText(body.clinic_name || "", 160);
    const notes = sanitizeText(body.notes || "", 500);

    if (!Number.isInteger(petId) || petId <= 0 || !title) {
      return Response.json({ error: "Pet and record title are required." }, { status: 400 });
    }

    const petCheck = await sql`
      SELECT id FROM pets WHERE id = ${petId} AND user_id = ${authResult.user.id} LIMIT 1
    `;
    if (!petCheck || petCheck.length === 0) {
      return Response.json({ error: "Pet profile not found." }, { status: 404 });
    }

    const inserted = await sql`
      INSERT INTO pet_health_records (
        user_id, pet_id, record_type, title, record_date, next_due_date, clinic_name, notes
      ) VALUES (
        ${authResult.user.id}, ${petId}, ${recordType}, ${title}, ${recordDate},
        ${nextDueDate}, ${clinicName || null}, ${notes || null}
      )
      RETURNING *
    `;

    return Response.json({ record: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating pet health record:", error);
    return Response.json({ error: "Failed to save pet health record" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "", 10);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Valid record ID is required." }, { status: 400 });
    }

    await sql`
      DELETE FROM pet_health_records WHERE id = ${id} AND user_id = ${authResult.user.id}
    `;
    return Response.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting pet health record:", error);
    return Response.json({ error: "Failed to delete record" }, { status: 500 });
  }
}

