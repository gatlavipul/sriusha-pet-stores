import sql from "../app/api/utils/sql.js";
import logger from "./logger.js";
import { sendEmail, sendWelcomeEmail, isResendConfigured } from "./resendService.js";

/**
 * Sri Usha Notification Architecture
 * Handles admin operational alerts and customer communications (Resend Email, SMS, WhatsApp).
 * Runs seamlessly on Cloudflare Workers and Node.js.
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
  WELCOME: "welcome",
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
 * Records and dispatches customer order notifications across Email (Resend), SMS, or WhatsApp
 */
export async function notifyCustomer({
  userId = null,
  orderId = null,
  channel = "email",
  recipient,
  templateType,
  title,
  content,
  htmlContent = null,
}) {
  try {
    if (!recipient || !title || !content) {
      logger.warn("notify_customer_invalid_args", "Missing required fields for customer notification", {
        orderId,
        recipient,
      });
      return null;
    }

    let dispatchStatus = "logged";

    // 1. Transactional Email via Resend
    if (channel === "email") {
      const emailRes = await sendEmail({
        to: recipient,
        subject: title,
        html:
          htmlContent ||
          `<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
             <h2 style="color: #059669;">${title}</h2>
             <p>${content}</p>
             <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Sri Usha Vet & Pet Stores, Uppal, Hyderabad</p>
           </div>`,
        text: content,
      });

      if (emailRes.mode === "sent") {
        dispatchStatus = "sent";
      } else {
        dispatchStatus = "logged";
      }
    } else if (channel === "sms" && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)) {
      dispatchStatus = "queued";
    } else if (channel === "whatsapp") {
      const waToken = process.env.WHATSAPP_API_TOKEN;
      const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (waToken && waPhoneId) {
        try {
          const digits = String(recipient).replace(/\D/g, "");
          const e164 = digits.length === 10 ? `91${digits}` : digits;
          const waRes = await fetch(
            `https://graph.facebook.com/v20.0/${waPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${waToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: e164,
                type: "text",
                text: { body: `${title}\n${content}` },
              }),
            }
          );
          dispatchStatus = waRes.ok ? "sent" : "failed";
        } catch (waErr) {
          logger.error("whatsapp_dispatch_error", "WhatsApp API call failed", waErr, { orderId });
          dispatchStatus = "failed";
        }
      } else {
        // Safe queue/log mode when WhatsApp credentials are not yet configured
        dispatchStatus = "queued";
      }
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
 * Sends customer account welcome email and logs customer notification
 */
export async function triggerWelcomeNotification(user) {
  if (!user || !user.email) return;

  const emailRes = await sendWelcomeEmail({
    to: user.email,
    name: user.name,
  });

  const status = emailRes.mode === "sent" ? "sent" : "logged";

  try {
    await sql`
      INSERT INTO customer_notifications (
        user_id, order_id, channel, recipient, template_type, title, content, status, created_at
      ) VALUES (
        ${user.id || null}, NULL, 'email', ${user.email}, 'welcome',
        'Welcome to Sri Usha Vet & Pet Stores! 🐾',
        ${`Welcome ${user.name || "Customer"}! Your account at Sri Usha Vet & Pet Stores is ready.`},
        ${status}, NOW()
      )
    `;
  } catch (e) {
    logger.error("welcome_notification_record_failed", "Could not log welcome notification", e);
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

      // 2. Customer Email via Resend
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

      if (customerPhone) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "whatsapp",
          recipient: customerPhone,
          templateType: "order_confirmed",
          title: `Order Confirmed: ${orderNum}`,
          content: `Hi ${customerName}, your Sri Usha Vet & Pet Stores order ${orderNum} (₹${parseFloat(order.total_amount || 0).toFixed(0)}) is confirmed!`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.ORDER_PACKING: {
      await notifyAdmin({
        type: NOTIFICATION_TYPES.ORDER_PACKING,
        title: `Order Packing (${orderNum})`,
        message: `Order ${orderNum} is being packed at the store.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_packing",
          title: `Packing Your Order: ${orderNum}`,
          content: `Your items are now being carefully packed with tamper-proof seal at our Uppal store.`,
        });
      }

      if (customerPhone) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "whatsapp",
          recipient: customerPhone,
          templateType: "order_packing",
          title: `Order Packed: ${orderNum}`,
          content: `Hi ${customerName}, your order ${orderNum} is now being packed with care at Sri Usha Vet & Pet Stores.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.ORDER_READY: {
      await notifyAdmin({
        type: NOTIFICATION_TYPES.ORDER_READY,
        title: `Order Ready For Delivery (${orderNum})`,
        message: `Order ${orderNum} packed and staged at dispatch counter.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_ready",
          title: `Order Ready: ${orderNum}`,
          content: `Your order is packed and ready for dispatch. A delivery partner will be assigned shortly.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.ORDER_ASSIGNED: {
      const driverName = extra.driverName || "Delivery Partner";
      await notifyAdmin({
        type: NOTIFICATION_TYPES.ORDER_ASSIGNED,
        title: `Order Assigned (${orderNum})`,
        message: `Order ${orderNum} assigned to driver ${driverName}.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_assigned",
          title: `Delivery Partner Assigned: ${orderNum}`,
          content: `${driverName} has been assigned to deliver your order.`,
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
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "whatsapp",
          recipient: customerPhone,
          templateType: "out_for_delivery",
          title: `Out for Delivery: ${orderNum}`,
          content: `Hi ${customerName}, ${driverName} is out for delivery with your Sri Usha order ${orderNum}!`,
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

      if (customerPhone) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "whatsapp",
          recipient: customerPhone,
          templateType: "order_delivered",
          title: `Order Delivered: ${orderNum}`,
          content: `Hi ${customerName}, your Sri Usha order ${orderNum} has been delivered. Thank you for caring with us! 🐾`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.DELIVERY_FAILED: {
      const reason = extra.failureReason || order.delivery_failure_reason || "Customer unavailable";
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

      if (customerPhone) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "whatsapp",
          recipient: customerPhone,
          templateType: "delivery_failed",
          title: `Delivery Issue: ${orderNum}`,
          content: `Hi ${customerName}, delivery for order ${orderNum} could not be completed (${reason}). Our Uppal store team will reschedule with you shortly.`,
        });
      }
      break;
    }

    case NOTIFICATION_TYPES.ORDER_CANCELLED: {
      const reason = extra.reason || order.cancellation_reason || "Requested by customer or store";
      await notifyAdmin({
        type: NOTIFICATION_TYPES.ORDER_CANCELLED,
        title: `Order Cancelled (${orderNum})`,
        message: `Order ${orderNum} has been cancelled: "${reason}". Inventory restored.`,
        orderId: order.id,
      });

      if (customerEmail) {
        await notifyCustomer({
          userId: order.user_id,
          orderId: order.id,
          channel: "email",
          recipient: customerEmail,
          templateType: "order_cancelled",
          title: `Order Cancelled: ${orderNum}`,
          content: `Your order ${orderNum} has been cancelled (${reason}). If prepaid, refund will process within 5-7 working days.`,
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
    const recent = await sql`
      SELECT id FROM admin_notifications 
      WHERE product_id = ${productId} 
        AND type = 'low_stock' 
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    if (recent.length > 0) {
      return false;
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

export default {
  NOTIFICATION_TYPES,
  notifyAdmin,
  notifyCustomer,
  triggerOrderNotifications,
  triggerWelcomeNotification,
  checkAndTriggerLowStock,
  isResendConfigured,
};
