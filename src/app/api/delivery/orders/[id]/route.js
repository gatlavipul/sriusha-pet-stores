import sql from "@/app/api/utils/sql";
import { requireDeliveryPartner, sanitizeText } from "@/app/api/utils/security";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireDeliveryPartner();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partnerId = authResult.user.id;
    const { id } = params;
    const body = await request.json();
    const { status, notes } = body || {};

    if (!status || (status !== "out_for_delivery" && status !== "delivered")) {
      return Response.json(
        { error: "Delivery partners may only update status to 'out_for_delivery' or 'delivered'." },
        { status: 400 }
      );
    }

    // Verify order exists and is assigned to this delivery partner
    const existingOrders = await sql`
      SELECT * FROM orders 
      WHERE id = ${id} AND assigned_delivery_partner_id = ${partnerId}
      LIMIT 1
    `;

    if (existingOrders.length === 0) {
      return Response.json(
        { error: "Order not found or not assigned to your delivery partner account." },
        { status: 403 }
      );
    }

    const currentOrder = existingOrders[0];

    // Enforce valid lifecycle transitions
    if (status === "out_for_delivery") {
      const allowedPrevious = ["assigned", "ready_for_delivery", "packed", "processing", "confirmed"];
      if (!allowedPrevious.includes(currentOrder.status)) {
        return Response.json(
          { error: `Cannot transition order from '${currentOrder.status}' to 'out_for_delivery'.` },
          { status: 400 }
        );
      }
    } else if (status === "delivered") {
      if (currentOrder.status !== "out_for_delivery") {
        return Response.json(
          { error: "Order must be 'out_for_delivery' before it can be marked as 'delivered'." },
          { status: 400 }
        );
      }
    }

    // Update order status (and mark COD payment paid if delivered)
    const cleanNotes = notes ? sanitizeText(notes, 255) : null;
    let paymentUpdateSql = "";
    if (status === "delivered" && currentOrder.payment_method === "cod") {
      await sql`
        UPDATE orders 
        SET status = ${status}, payment_status = 'paid', updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE orders 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    // Record audit timeline in order_status_history
    const noteText = cleanNotes || (status === "out_for_delivery" ? "Driver started delivery" : "Package delivered to customer");
    await sql`
      INSERT INTO order_status_history (
        order_id, status, changed_by_user_id, changed_by_role, notes
      ) VALUES (
        ${id}, ${status}, ${partnerId}, 'delivery_partner', ${noteText}
      )
    `;

    const updated = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;

    return Response.json({
      success: true,
      message: `Order status updated to ${status}.`,
      order: updated[0],
    });
  } catch (error) {
    console.error("Error updating delivery order:", error);
    return Response.json({ error: "Failed to update delivery order" }, { status: 500 });
  }
}
