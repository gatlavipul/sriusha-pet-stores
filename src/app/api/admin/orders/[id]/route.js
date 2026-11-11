import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

const VALID_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const orders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    if (orders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orders[0];
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${id}`;

    return Response.json({
      order: {
        ...order,
        order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
        items,
      },
    });
  } catch (error) {
    console.error("Error fetching admin order:", error);
    return Response.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const body = await request.json();
    const { status, payment_status, cancellation_reason } = body;

    // Fetch existing order to check current state
    const existingOrders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    if (existingOrders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    const currentOrder = existingOrders[0];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Validate and update status
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return Response.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;

      // Inventory restoration when cancelling
      if (status === "cancelled" && currentOrder.status !== "cancelled") {
        updates.push(`cancelled_at = NOW()`);
        if (cancellation_reason) {
          updates.push(`cancellation_reason = $${paramIndex}`);
          values.push(sanitizeText(cancellation_reason, 255));
          paramIndex++;
        }

        // Restore inventory stock for this order's items
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
      } else if (currentOrder.status === "cancelled" && status !== "cancelled") {
        // Un-cancelling: re-decrement stock
        const items = await sql`SELECT product_id, quantity FROM order_items WHERE order_id = ${id}`;
        for (const item of items) {
          if (item.product_id && item.quantity > 0) {
            await sql`
              UPDATE products 
              SET stock_quantity = GREATEST(0, stock_quantity - ${item.quantity}), updated_at = NOW()
              WHERE id = ${item.product_id}
            `;
          }
        }
      }
    }

    // Validate and update payment status
    if (payment_status !== undefined) {
      if (!VALID_PAYMENT_STATUSES.includes(payment_status)) {
        return Response.json(
          { error: `Invalid payment status. Must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.push(`payment_status = $${paramIndex}`);
      values.push(payment_status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields provided to update" }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE orders SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const updated = await sql(query, values);

    return Response.json({ success: true, order: updated[0] });
  } catch (error) {
    console.error("Error updating admin order:", error);
    return Response.json({ error: "Failed to update order" }, { status: 500 });
  }
}
