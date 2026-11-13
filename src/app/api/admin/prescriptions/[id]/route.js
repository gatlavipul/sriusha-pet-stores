import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";
import { notifyCustomer } from "@/utils/notificationService";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const rxId = parseInt(params?.id, 10);
    if (!Number.isInteger(rxId) || rxId <= 0) {
      return Response.json({ error: "Invalid prescription ID" }, { status: 400 });
    }

    const body = await request.json();
    const status = body.status;
    const notes = sanitizeText(body.notes || "", 500);

    if (!["approved", "rejected", "resubmit_requested", "pending_review"].includes(status)) {
      return Response.json(
        { error: "Status must be 'approved', 'rejected', 'resubmit_requested', or 'pending_review'." },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE prescriptions
      SET
        status = ${status},
        notes = ${notes || null},
        reviewed_by = ${authResult.user.id},
        reviewed_at = NOW()
      WHERE id = ${rxId}
      RETURNING *
    `;

    if (!updated || updated.length === 0) {
      return Response.json({ error: "Prescription not found" }, { status: 404 });
    }

    const rx = updated[0];

    if (rx.order_id) {
      await sql`
        UPDATE orders
        SET prescription_status = ${status}, updated_at = NOW()
        WHERE id = ${rx.order_id}
      `;

      if (status === "approved") {
        const advanced = await sql`
          UPDATE orders
          SET status = 'confirmed', updated_at = NOW()
          WHERE id = ${rx.order_id} AND status = 'prescription_review'
          RETURNING id
        `;
        if (advanced?.length > 0) {
          await sql`
            INSERT INTO order_status_history (
              order_id, previous_status, new_status, changed_by_user_id, changed_by_role, notes
            ) VALUES (
              ${rx.order_id}, 'prescription_review', 'confirmed', ${authResult.user.id}, 'admin',
              ${`Prescription #${rx.id} approved${notes ? `: ${notes}` : ""}`}
            )
          `;
        }
      }
    }

    const userRows = await sql`
      SELECT id, name, email FROM auth_users WHERE id = ${rx.user_id} LIMIT 1
    `;
    const customer = userRows?.[0];
    if (customer?.email) {
      const label = status === "approved" ? "Approved" : status === "rejected" ? "Needs Attention / Rejected" : "Under Review";
      await notifyCustomer({
        userId: customer.id,
        orderId: rx.order_id || null,
        channel: "email",
        recipient: customer.email,
        templateType: "prescription_status",
        title: `Prescription #${rx.id} ${label} — Sri Usha Vet Stores`,
        content: `Hi ${customer.name || "Pet Parent"}, your uploaded veterinary prescription (#${rx.id}) status is now: ${label}.${notes ? ` Reviewer notes: ${notes}` : ""}`,
      });
    }

    return Response.json({ prescription: rx });
  } catch (error) {
    console.error("Error reviewing prescription:", error);
    return Response.json({ error: "Failed to review prescription" }, { status: 500 });
  }
}

