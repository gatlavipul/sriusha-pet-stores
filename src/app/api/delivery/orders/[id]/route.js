import sql from "@/app/api/utils/sql";
import { requireDeliveryPartner, sanitizeText } from "@/app/api/utils/security";
import { ORDER_STATUS, validateTransition } from "@/utils/orderWorkflow";
import { triggerOrderNotifications, NOTIFICATION_TYPES } from "@/utils/notificationService";
import logger from "@/utils/logger";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireDeliveryPartner();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partnerId = authResult.user.id;
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { status, failure_reason, notes } = body;

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

    // Verify order exists and is assigned specifically to this delivery partner
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

    // Enforce role-based state machine transition
    const transitionError = validateTransition(currentOrder.status, status, "delivery_partner");
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
      const isCOD = currentOrder.payment_method === "cod";
      const targetPaymentStatus = isCOD ? "paid" : currentOrder.payment_status;

      await sql`
        UPDATE orders 
        SET 
          status = ${ORDER_STATUS.DELIVERED},
          payment_status = ${targetPaymentStatus},
          delivery_failure_reason = NULL,
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
