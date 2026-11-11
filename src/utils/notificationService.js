import sql from "../app/api/utils/sql.js";
import logger from "./logger.js";

/**
 * Sri Usha Notification Architecture
 * Handles admin operational alerts and customer communications (Email, SMS, WhatsApp).
 */

export const NOTIFICATION_TYPES = {
  NEW_ORDER: "new_order",
  ORDER_CONFIRMED: "order_confirmed",
  ORDER_PACKING: "order_packing",
  ORDER_READY: "order_ready",
  ORDER_ASSIGNED: "order_assigned",
  OUT_FOR_DELIVERY: "out_for_delivery",
  ORDER_DELIVERED: "order_delivered",
  DELIVERY_FAILED: "delivery_failed",
  ORDER_CANCELLED: "order_cancelled",
  LOW_STOCK: "low_stock",
  PAYMENT_ISSUE: "payment_issue",
};

/**
 * Creates an in-app operational alert for store administrators
 * Supports either object options { type, title, message, ... } or positional arguments
 */
export async function notifyAdmin(param1, param2, param3, param4) {
  let type, title, message, orderId, productId, linkUrl, metadata;
  if (typeof param1 === "object" && param1 !== null && !param2) {
    ({
      type,
      title,
      message,
      orderId = null,
      productId = null,
      linkUrl = null,
      metadata = null,
    } = param1);
  } else {
    type = param1;
    title = param2;
    message = param3;
    const opts = param4 || {};
    orderId = opts.orderId || null;
    productId = opts.productId || null;
    linkUrl = opts.linkUrl || null;
    metadata = opts.metadata || null;
  }

  try {
    const fallbackLink = orderId
      ? `/admin/orders`
      : productId
      ? `/admin/products?id=${productId}`
      : `/admin`;

    const res = await sql`
      INSERT INTO admin_notifications (
        type, title, message, order_id, product_id, link_url, metadata, is_read, created_at
      ) VALUES (
        ${type}, ${title}, ${message}, ${orderId}, ${productId},
        ${linkUrl || fallbackLink}, ${metadata ? JSON.stringify(metadata) : null}::jsonb,
        FALSE, NOW()
      )
      RETURNING *
    `;

    logger.info("admin_notification_created", `Admin Alert [${type}]: ${title}`, {
      notificationId: res[0]?.id,
      type,
      orderId,
      productId,
    });

    return res[0];
  } catch (error) {
    logger.error("notify_admin_failed", "Failed to insert admin notification", error, { type, title });
    return null;
  }
}

/**
 * Records and dispatches customer order notifications across Email, SMS, or WhatsApp
 */
export async function notifyCustomer({
  userId = null,
  orderId,
  channel = "email",
  recipient,
  templateType,
  title,
  content,
}) {
  try {
    if (!orderId || !recipient || !title || !content) {
      logger.warn("notify_customer_invalid_args", "Missing required fields for customer notification", {
        orderId,
        recipient,
      });
      return null;
    }

    // Determine dispatch status based on whether live credentials exist
    let dispatchStatus = "logged";
    const hasEmailProvider = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    const hasSmsProvider = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const hasWhatsAppProvider = Boolean(process.env.WHATSAPP_API_TOKEN);

    if (channel === "email" && hasEmailProvider) {
      // Future live email provider trigger
      dispatchStatus = "queued";
    } else if (channel === "sms" && hasSmsProvider) {
      // Future live SMS provider trigger
      dispatchStatus = "queued";
    } else if (channel === "whatsapp" && hasWhatsAppProvider) {
      // Future WhatsApp Business API trigger
      dispatchStatus = "queued";
    }

    const res = await sql`
      INSERT INTO customer_notifications (
        user_id, order_id, channel, recipient, template_type, title, content, status, created_at
      ) VALUES (
        ${userId}, ${orderId}, ${channel}, ${recipient}, ${templateType}, ${title}, ${content}, ${dispatchStatus}, NOW()
      )
      RETURNING *
    `;

    logger.info("customer_notification_dispatched", `Customer [${channel.toUpperCase()}] -> ${recipient}: ${title}`, {
      orderId,
      channel,
      status: dispatchStatus,
      templateType,
    });

    return res[0];
  } catch (error) {
    logger.error("notify_customer_failed", "Failed to record customer notification", error, {
      orderId,
      recipient,
      channel,
    });
    return null;
  }
}

/**
 * High-level orchestration for order lifecycle notifications
 */
export async function triggerOrderNotifications(eventType, order, extra = {}) {
  if (!order || !order.id) return;

  const orderNum = order.order_number || `Order #${order.id}`;
  const customerEmail = order.customer_email;
  const customerPhone = order.customer_phone;
  const customerName = order.customer_name || "Valued Pet Parent";

  switch (eventType) {
    case NOTIFICATION_TYPES.NEW_ORDER: {
      // 1. Admin Alert
      await notifyAdmin({
        type: NOTIFICATION_TYPES.NEW_ORDER,
        title: `New Order Placed (${orderNum})`,
        message: `${customerName} placed order for ₹${parseFloat(order.total_amount).toFixed(0)} via ${order.payment_method?.toUpperCase()}.`,
        orderId: order.id,
        linkUrl: `/admin/orders`,
      });

      // 2. Customer Email
      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_placed",
          title: `Your Sri Usha Order #${order.id} is Placed!`,
          content: `Hi ${customerName}, we have received your order of ₹${parseFloat(order.total_amount).toFixed(0)}. Our Uppal team is getting it ready!`,
        });
      }

      // 3. Customer SMS
      if (customerPhone) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "sms",
          recipient: customerPhone,
          templateType: "order_placed",
          title: "Order Placed",
          content: `Sri Usha Pet Stores: Order ${orderNum} confirmed. Total: Rs. ${parseFloat(order.total_amount).toFixed(0)}. Track at https://sriushastores.in/orders/${order.id}`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.ORDER_CONFIRMED: {
      await notifyAdmin({
        type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
        title: `Order Confirmed (${orderNum})`,
        message: `Order ${orderNum} confirmed and verified. Ready for warehouse picking.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_confirmed",
          title: `Order Confirmed: ${orderNum}`,
          content: `Good news! Your order ${orderNum} has been confirmed by Sri Usha Vet & Pet Stores.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.OUT_FOR_DELIVERY: {
      const driverName = extra.driverName || "Our delivery partner";
      await notifyAdmin({
        type: NOTIFICATION_TYPES.OUT_FOR_DELIVERY,
        title: `Order Out for Delivery (${orderNum})`,
        message: `${driverName} is in transit to ${order.shipping_city || "customer"}.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "out_for_delivery",
          title: `Out for Delivery: ${orderNum}`,
          content: `${driverName} is on the way to your doorstep with your pet supplies!`,
        });
      }

      if (customerPhone) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "sms",
          recipient: customerPhone,
          templateType: "out_for_delivery",
          title: "Out for Delivery",
          content: `Sri Usha: Order ${orderNum} is out for delivery with ${driverName}. Please keep payment ready if COD.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.ORDER_DELIVERED: {
      await notifyAdmin({
        type: NOTIFICATION_TYPES.ORDER_DELIVERED,
        title: `Delivered: ${orderNum}`,
        message: `Package successfully delivered to ${customerName}. COD settled if applicable.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_delivered",
          title: `Delivered! Thank you from Sri Usha Vet Stores`,
          content: `Your package for ${orderNum} has been delivered. Thank you for trusting Sri Usha for your veterinary and pet care needs.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.DELIVERY_FAILED: {
      const reason = extra.failureReason || order.delivery_failure_reason || "Customer unavailable";
      // High-priority admin alert
      await notifyAdmin({
        type: NOTIFICATION_TYPES.DELIVERY_FAILED,
        title: `🚨 Delivery Exception: ${orderNum}`,
        message: `Driver reported failure: "${reason}". Action required in orders management.`,
        orderId: order.id,
        linkUrl: `/admin/orders`,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "delivery_failed",
          title: `Delivery Attempt Unsuccessful: ${orderNum}`,
          content: `We were unable to complete delivery (${reason}). Our support team will reach out to reschedule.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.PAYMENT_ISSUE: {
      await notifyAdmin({
        type: NOTIFICATION_TYPES.PAYMENT_ISSUE,
        title: `Payment Issue: ${orderNum}`,
        message: `Payment failed or mismatch detected for order: ${extra.reason || "Verification error"}`,
        orderId: order.id,
      });
      break;
    }

    default:
      break;
  }
}

/**
 * Checks product stock and generates low-stock operational alert
 * Idempotently suppresses duplicate notifications for the same product within 24 hours
 */
export async function checkAndTriggerLowStock(productId, currentStock, productName) {
  if (currentStock <= 5) {
    // Check if an unread or recent alert was already created in the last 24 hours
    const recent = await sql`
      SELECT id FROM admin_notifications 
      WHERE product_id = ${productId} 
        AND type = 'low_stock' 
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    if (recent.length > 0) {
      return false; // Suppressed / already notified
    }

    const isCritical = currentStock === 0;
    const title = isCritical ? `Out of Stock: ${productName}` : `Low Stock Alert: ${productName}`;
    const message = isCritical
      ? `Product "${productName}" is completely OUT OF STOCK (0 units). Restock urgently.`
      : `Product "${productName}" has only ${currentStock} unit(s) remaining in store.`;

    const res = await notifyAdmin({
      type: NOTIFICATION_TYPES.LOW_STOCK,
      title,
      message,
      productId,
      linkUrl: `/admin/products?id=${productId}`,
      metadata: { currentStock, isCritical },
    });
    return Boolean(res);
  }
  return false;
}

