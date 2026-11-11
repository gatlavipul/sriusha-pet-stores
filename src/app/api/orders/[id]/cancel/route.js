import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sanitizeText } from "@/app/api/utils/security";

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

    // Authorization: User must own the order or be admin or verify by email
    const isOwner = session?.user?.id && order.user_id === session.user.id;
    const isEmailMatched = email && order.customer_email.toLowerCase() === email.toLowerCase().trim();

    let isAdmin = false;
    if (session?.user?.id) {
      const u = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
      isAdmin = u[0]?.role === "admin";
    }

    if (!isOwner && !isAdmin && !isEmailMatched) {
      return Response.json({ error: "Unauthorized to cancel this order" }, { status: 403 });
    }

    // Check if order is eligible for cancellation
    const cancellableStatuses = ["pending", "processing", "confirmed"];
    if (!cancellableStatuses.includes(order.status)) {
      return Response.json(
        {
          error: `Order cannot be cancelled in its current stage ('${order.status}'). Items have already been packed or shipped. Please call customer support at +91 98765 43210 for assistance.`,
        },
        { status: 400 }
      );
    }

    // 1. Restore product inventory stock
    const items = await sql`SELECT product_id, quantity FROM order_items WHERE order_id = ${id}`;
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        await sql`
          UPDATE products 
          SET stock_quantity = stock_quantity + ${item.quantity}, updated_at = NOW()
          WHERE id = ${item.product_id}
        `;
      }
    }

    // 2. Determine refund state if paid
    const newPaymentStatus = order.payment_status === "paid" ? "refunded" : order.payment_status;
    const cancelReason = sanitizeText(reason || "Customer requested cancellation before dispatch", 255);

    // 3. Update order
    const updated = await sql`
      UPDATE orders 
      SET 
        status = 'cancelled',
        payment_status = ${newPaymentStatus},
        cancellation_reason = ${cancelReason},
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({
      success: true,
      message: "Order has been successfully cancelled and items returned to store stock.",
      order: updated[0],
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return Response.json({ error: "Failed to cancel order: " + error.message }, { status: 500 });
  }
}

