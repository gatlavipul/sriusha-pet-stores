import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sanitizeText } from "@/app/api/utils/security";
import { isCancellableByCustomer, ORDER_STATUS } from "@/utils/orderWorkflow";
import { restoreStockForOrder } from "@/utils/stockService";

export async function POST(request, { params }) {
  try {
    const session = await auth();
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { reason, email } = body;

    // Fetch order
    const orders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    if (orders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    const order = orders[0];

    // Authorization: User must own the order or be admin or verify by customer_email match
    const isOwner = session?.user?.id && order.user_id === session.user.id;
    const isEmailMatched = email && order.customer_email.toLowerCase() === email.toLowerCase().trim();

    let isAdmin = false;
    if (session?.user?.id) {
      const u = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
      isAdmin = u[0]?.role === "admin";
    }

    if (!isOwner && !isAdmin && !isEmailMatched) {
      return Response.json({ error: "Unauthorized to cancel this order" }, { status: 403 });
    }

    // Role-based cancellation check
    // Customers cannot cancel once the order has reached delivery transit
    if (!isAdmin && !isCancellableByCustomer(order.status)) {
      const phoneSettings = await sql`SELECT value FROM settings WHERE key = 'store_phone' LIMIT 1`;
      const supportPhone = phoneSettings[0]?.value || "+91 94402 74418";
      return Response.json(
        {
          error: `Order cannot be cancelled in its current stage ('${order.status}'). Items have already been dispatched or delivered. Please contact customer care at ${supportPhone} for support.`,
        },
        { status: 400 }
      );
    }

    // Admins cannot cancel an already delivered order through this endpoint
    if (order.status === ORDER_STATUS.DELIVERED) {
      return Response.json(
        { error: "Delivered orders cannot be cancelled. A return request must be initiated." },
        { status: 400 }
      );
    }

    // 1. Restore product/variant inventory stock ONLY if not already restored (Idempotency Protection)
    await restoreStockForOrder({
      orderId: Number(id),
      userId: session?.user?.id ? Number(session.user.id) : null,
      userName: session?.user?.name || "Customer",
    });

    // 2. Determine refund state if paid online
    const newPaymentStatus = order.payment_status === "paid" ? "refunded" : order.payment_status;
    const cancelReason = sanitizeText(
      reason || (isAdmin ? "Cancelled by store administrator" : "Customer requested cancellation before dispatch"),
      255
    );

    // 3. Update order record
    const updated = await sql`
      UPDATE orders 
      SET 
        status = ${ORDER_STATUS.CANCELLED},
        stock_restored = TRUE,
        payment_status = ${newPaymentStatus},
        cancellation_reason = ${cancelReason},
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // 4. Record audit timeline entry
    await sql`
      INSERT INTO order_status_history (
        order_id, status, changed_by_user_id, changed_by_role, notes
      ) VALUES (
        ${id}, 
        ${ORDER_STATUS.CANCELLED}, 
        ${session?.user?.id || null}, 
        ${isAdmin ? "admin" : "customer"}, 
        ${cancelReason}
      )
    `;

    return Response.json({
      success: true,
      message: "Order has been successfully cancelled and stock restored to inventory.",
      order: updated[0],
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return Response.json({ error: "Failed to cancel order: " + error.message }, { status: 500 });
  }
}
