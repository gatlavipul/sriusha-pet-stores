import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const subId = parseInt(params?.id, 10);
    if (!Number.isInteger(subId) || subId <= 0) {
      return Response.json({ error: "Invalid subscription ID" }, { status: 400 });
    }

    const existing = await sql`
      SELECT * FROM pet_subscriptions WHERE id = ${subId} AND user_id = ${authResult.user.id} LIMIT 1
    `;
    if (!existing || existing.length === 0) {
      return Response.json({ error: "Subscription not found" }, { status: 404 });
    }

    const sub = existing[0];
    const body = await request.json();
    const action = body.action;

    if (action === "pause") {
      const upd = await sql`
        UPDATE pet_subscriptions SET status = 'paused', updated_at = NOW()
        WHERE id = ${subId} RETURNING *
      `;
      return Response.json({ subscription: upd[0] });
    }

    if (action === "resume") {
      const upd = await sql`
        UPDATE pet_subscriptions SET status = 'active', updated_at = NOW()
        WHERE id = ${subId} RETURNING *
      `;
      return Response.json({ subscription: upd[0] });
    }

    if (action === "skip") {
      const upd = await sql`
        UPDATE pet_subscriptions
        SET next_delivery_date = (next_delivery_date + ${sub.frequency_days}::int), updated_at = NOW()
        WHERE id = ${subId} RETURNING *
      `;
      return Response.json({ subscription: upd[0] });
    }

    if (action === "cancel") {
      const upd = await sql`
        UPDATE pet_subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${subId} RETURNING *
      `;
      return Response.json({ subscription: upd[0] });
    }

    return Response.json({ error: "Invalid subscription action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return Response.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}

