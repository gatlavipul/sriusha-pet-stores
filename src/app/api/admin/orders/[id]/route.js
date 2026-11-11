import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";
import {
  ORDER_STATUS,
  ALL_ORDER_STATUSES,
  validateTransition,
} from "@/utils/orderWorkflow";

const VALID_STATUSES = ALL_ORDER_STATUSES;

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
    const orders = await sql`
      SELECT 
        o.*,
        dp.name as delivery_partner_name,
        dp.email as delivery_partner_email
      FROM orders o
      LEFT JOIN auth_users dp ON o.assigned_delivery_partner_id = dp.id
      WHERE o.id = ${id} 
      LIMIT 1
    `;

    if (orders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orders[0];
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${id}`;

    // Order status timeline history
    const history = await sql`
      SELECT h.*, u.name as changed_by_name
      FROM order_status_history h
      LEFT JOIN auth_users u ON u.id = h.changed_by_user_id
      WHERE h.order_id = ${id}
      ORDER BY h.created_at ASC
    `;

    // Available delivery partners for assignment
    const deliveryPartners = await sql`
      SELECT id, name, email 
      FROM auth_users 
      WHERE role = 'delivery_partner'
      ORDER BY name ASC
    `;

    // Fetch related admin notifications for this order
    const notifications = await sql`
      SELECT * FROM admin_notifications
      WHERE order_id = ${id}
      ORDER BY created_at DESC
    `;

    return Response.json({
      order: {
        ...order,
        order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
        items,
        history,
        notifications,
      },
      deliveryPartners,
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
    const {
      status,
      payment_status,
      cancellation_reason,
      assigned_delivery_partner_id,
      notes,
    } = body;

    // Fetch existing order to check current state
    const existingOrders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    if (existingOrders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    const currentOrder = existingOrders[0];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    let targetStatus = status;

    // Assigning Delivery Partner
    if (assigned_delivery_partner_id !== undefined) {
      if (assigned_delivery_partner_id === null || assigned_delivery_partner_id === "") {
        updates.push(`assigned_delivery_partner_id = NULL`);
      } else {
        const partnerCheck = await sql`
          SELECT id, name, role FROM auth_users 
          WHERE id = ${assigned_delivery_partner_id} AND role = 'delivery_partner'
          LIMIT 1
        `;
        if (partnerCheck.length === 0) {
          return Response.json(
            { error: "Selected user is not an active delivery partner." },
            { status: 400 }
          );
        }

        updates.push(`assigned_delivery_partner_id = $${paramIndex}`);
        values.push(assigned_delivery_partner_id);
        paramIndex++;

        // If assigning partner and no explicit status requested, set status to 'assigned'
        if (!targetStatus && (
          currentOrder.status === ORDER_STATUS.READY_FOR_DELIVERY ||
          currentOrder.status === ORDER_STATUS.PACKING ||
          currentOrder.status === ORDER_STATUS.CONFIRMED ||
          currentOrder.status === ORDER_STATUS.DELIVERY_FAILED
        )) {
          targetStatus = ORDER_STATUS.ASSIGNED;
        }
      }
    }

    // Validate and update status
    if (targetStatus !== undefined) {
      if (!VALID_STATUSES.includes(targetStatus)) {
        return Response.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      // Enforce role-based workflow transition rules
      if (targetStatus !== currentOrder.status) {
        const transitionError = validateTransition(currentOrder.status, targetStatus, "admin");
        if (transitionError) {
          return Response.json({ error: transitionError }, { status: 400 });
        }
      }

      updates.push(`status = $${paramIndex}`);
      values.push(targetStatus);
      paramIndex++;

      // If recovering from delivery_failed, clear the failure reason
      if (
        currentOrder.status === ORDER_STATUS.DELIVERY_FAILED &&
        (targetStatus === ORDER_STATUS.ASSIGNED || targetStatus === ORDER_STATUS.READY_FOR_DELIVERY)
      ) {
        updates.push(`delivery_failure_reason = NULL`);
      }

      // Inventory restoration when cancelling (strictly once!)
      if (targetStatus === ORDER_STATUS.CANCELLED && currentOrder.status !== ORDER_STATUS.CANCELLED) {
        updates.push(`cancelled_at = NOW()`);
        if (cancellation_reason) {
          updates.push(`cancellation_reason = $${paramIndex}`);
          values.push(sanitizeText(cancellation_reason, 255));
          paramIndex++;
        }

        // Restore inventory stock only if not already restored
        if (!currentOrder.stock_restored) {
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
          updates.push(`stock_restored = TRUE`);
        }
      } else if (currentOrder.status === ORDER_STATUS.CANCELLED && targetStatus !== ORDER_STATUS.CANCELLED) {
        // Un-cancelling: re-decrement stock and reset stock_restored flag
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
        updates.push(`stock_restored = FALSE`);
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

    // Record timeline in order_status_history if status changed
    if (targetStatus && targetStatus !== currentOrder.status) {
      const historyNotes = notes ? sanitizeText(notes, 255) : `Status updated to ${targetStatus} by administrator`;
      await sql`
        INSERT INTO order_status_history (
          order_id, status, changed_by_user_id, changed_by_role, notes
        ) VALUES (
          ${id}, ${targetStatus}, ${authResult.user.id}, 'admin', ${historyNotes}
        )
      `;
    }

    return Response.json({ success: true, order: updated[0] });
  } catch (error) {
    console.error("Error updating admin order:", error);
    return Response.json({ error: "Failed to update order" }, { status: 500 });
  }
}
