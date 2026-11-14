import sql from "@/app/api/utils/sql";
import { requireDeliveryPartner, sanitizeText } from "@/app/api/utils/security";
import { ORDER_STATUS, validateTransition } from "@/utils/orderWorkflow";
import { triggerOrderNotifications, NOTIFICATION_TYPES } from "@/utils/notificationService";
import { awardPointsForCompletedOrder } from "@/utils/loyaltyService";
import logger from "@/utils/logger";

export async function GET(request, { params }) {
  try {
    const authResult = await requireDeliveryPartner(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partnerId = authResult.user.id;
    const { id } = params;

    // Delivery partners can ONLY view orders assigned to their account
    const existingOrders = await sql`
      SELECT o.*, o.order_number
      FROM orders o
      WHERE o.id = ${id} AND o.assigned_delivery_partner_id = ${partnerId}
      LIMIT 1
    `;

    if (existingOrders.length === 0) {
      return Response.json(
        { error: "Order not found or not assigned to your delivery partner account." },
        { status: 403 }
      );
    }

    const order = existingOrders[0];
    const [items, history] = await Promise.all([
      sql`SELECT * FROM order_items WHERE order_id = ${id}`,
      sql`
        SELECT h.*, u.name as changed_by_name
        FROM order_status_history h
        LEFT JOIN auth_users u ON u.id = h.changed_by_user_id
        WHERE h.order_id = ${id}
        ORDER BY h.created_at ASC
      `,
    ]);

    return Response.json({
      order: {
        ...order,
        order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
        items: items || [],
        history: history || [],
      },
    });
  } catch (error) {
    console.error("Error fetching delivery order:", error);
    return Response.json({ error: "Failed to fetch delivery order" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireDeliveryPartner(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partnerId = authResult.user.id;
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { status, failure_reason, notes, delivery_otp } = body;

    const allowedPartnerStatuses = [
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.DELIVERY_FAILED,
    ];

    if (!status || !allowedPartnerStatuses.includes(status)) {
      return Response.json(
        {
          error: `Delivery partners may only update status to: ${allowedPartnerStatuses.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Verify order exists and is assigned specifically to this delivery partner (admins can update any)
    const isAdmin = Boolean(authResult.isAdmin);
    let existingOrders;
    if (isAdmin) {
      existingOrders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
    } else {
      existingOrders = await sql`
        SELECT * FROM orders 
        WHERE id = ${id} AND assigned_delivery_partner_id = ${partnerId}
        LIMIT 1
      `;
    }

    if (existingOrders.length === 0) {
      return Response.json(
        { error: "Order not found or not assigned to your delivery partner account." },
        { status: 403 }
      );
    }

    const currentOrder = existingOrders[0];

    // Enforce role-based state machine transition
    const effectiveRole = isAdmin ? "admin" : "delivery_partner";
    const transitionError = validateTransition(currentOrder.status, status, effectiveRole);
    if (transitionError) {
      return Response.json({ error: transitionError }, { status: 400 });
    }

    // Delivery failure handling
    if (status === ORDER_STATUS.DELIVERY_FAILED) {
      const cleanReason = sanitizeText(failure_reason || notes, 255);
      if (!cleanReason || cleanReason.length < 3) {
        return Response.json(
          {
            error: "A valid delivery failure reason is required (e.g. 'Customer unavailable', 'Incorrect address', 'Delivery refused').",
          },
          { status: 400 }
        );
      }

      // Update order to delivery_failed (COD payment remains unpaid 'pending', stock remains reserved)
      await sql`
        UPDATE orders 
        SET 
          status = ${ORDER_STATUS.DELIVERY_FAILED},
          delivery_failure_reason = ${cleanReason},
          updated_at = NOW()
        WHERE id = ${id}
      `;

      // Record in audit timeline
      await sql`
        INSERT INTO order_status_history (
          order_id, status, changed_by_user_id, changed_by_role, notes
        ) VALUES (
          ${id},
          ${ORDER_STATUS.DELIVERY_FAILED},
          ${partnerId},
          'delivery_partner',
          ${`Delivery attempt failed: ${cleanReason}`}
        )
      `;

      // Notify administrator and customer
      const orderRef = currentOrder.order_number || `Order #${currentOrder.id}`;
      await sql`
        INSERT INTO admin_notifications (
          type, order_id, title, message
        ) VALUES (
          'delivery_failure',
          ${id},
          ${`Delivery Exception: ${orderRef}`},
          ${`Driver ${authResult.user.name || 'Partner'} reported failed delivery. Reason: ${cleanReason}. Action required: reassign driver, reschedule, or cancel.`}
        )
      `;

      const updated = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      await triggerOrderNotifications(NOTIFICATION_TYPES.DELIVERY_FAILED, updated[0], {
        failureReason: cleanReason,
        driverName: authResult.user.name,
      });

      logger.warn("delivery_attempt_failed", `Delivery failed for order ${orderRef}: ${cleanReason}`, {
        orderId: id,
        driverId: partnerId,
        reason: cleanReason,
      });

      return Response.json({
        success: true,
        message: "Delivery exception reported. Administrator has been alerted for re-dispatch or review.",
        order: updated[0],
      });
    }

    // Success delivery handling: Mark COD as paid strictly on verified successful delivery
    if (status === ORDER_STATUS.DELIVERED) {
      if (delivery_otp !== undefined && currentOrder.delivery_otp) {
        if (String(delivery_otp).trim() !== String(currentOrder.delivery_otp).trim()) {
          return Response.json(
            { error: "Invalid 4-digit Delivery OTP. Please confirm the OTP with the customer." },
            { status: 400 }
          );
        }
      }

      const isCOD = currentOrder.payment_method === "cod";
      const targetPaymentStatus = isCOD ? "paid" : currentOrder.payment_status;

      await sql`
        UPDATE orders 
        SET 
          status = ${ORDER_STATUS.DELIVERED},
          payment_status = ${targetPaymentStatus},
          delivery_failure_reason = NULL,
          delivered_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
      `;

      await sql`
        INSERT INTO order_status_history (
          order_id, status, changed_by_user_id, changed_by_role, notes
        ) VALUES (
          ${id},
          ${ORDER_STATUS.DELIVERED},
          ${partnerId},
          'delivery_partner',
          ${isCOD ? "Package delivered to customer. Cash on Delivery payment received and verified." : "Package successfully delivered to customer."}
        )
      `;

      const updated = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      await awardPointsForCompletedOrder(Number(id));
      await triggerOrderNotifications(NOTIFICATION_TYPES.ORDER_DELIVERED, updated[0], {
        driverName: authResult.user.name,
      });

      logger.info("order_delivered_success", `Order #${id} marked as delivered by ${authResult.user.name}`, {
        orderId: id,
        driverId: partnerId,
        isCOD,
        targetPaymentStatus,
      });

      return Response.json({
        success: true,
        message: "Order marked as delivered successfully.",
        order: updated[0],
      });
    }

    // Out for delivery handling
    if (status === ORDER_STATUS.OUT_FOR_DELIVERY) {
      await sql`
        UPDATE orders 
        SET 
          status = ${ORDER_STATUS.OUT_FOR_DELIVERY},
          picked_up_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
      `;

      await sql`
        INSERT INTO order_status_history (
          order_id, status, changed_by_user_id, changed_by_role, notes
        ) VALUES (
          ${id},
          ${ORDER_STATUS.OUT_FOR_DELIVERY},
          ${partnerId},
          'delivery_partner',
          ${notes ? sanitizeText(notes, 255) : "Driver started delivery navigation to customer address"}
        )
      `;

      const updated = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      await triggerOrderNotifications(NOTIFICATION_TYPES.OUT_FOR_DELIVERY, updated[0], {
        driverName: authResult.user.name,
      });

      logger.info("order_out_for_delivery", `Order #${id} out for delivery with ${authResult.user.name}`, {
        orderId: id,
        driverId: partnerId,
      });

      return Response.json({
        success: true,
        message: "Order is now out for delivery.",
        order: updated[0],
      });
    }

    return Response.json({ error: "Unhandled status transition" }, { status: 400 });
  } catch (error) {
    console.error("Error updating delivery order:", error);
    return Response.json({ error: "Failed to update delivery order: " + error.message }, { status: 500 });
  }
}
