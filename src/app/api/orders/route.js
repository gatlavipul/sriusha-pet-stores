import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { validateEmail, validatePhone, sanitizeText } from "@/app/api/utils/security";
import { ORDER_STATUS } from "@/utils/orderWorkflow";
import { checkServiceability } from "@/utils/serviceabilityService";
import {
  triggerOrderNotifications,
  NOTIFICATION_TYPES,
} from "@/utils/notificationService";
import { validateCheckoutPayload, deductVerifiedOrderStock } from "@/utils/checkoutOrderHelper";
import { recordOfferRedemption } from "@/utils/offerService";
import { commitPointRedemption } from "@/utils/loyaltyService";
import { rateLimiter, getClientIp } from "@/utils/rateLimiter";
import logger from "@/utils/logger";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orders = await sql`
      SELECT * FROM orders 
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
    `;

    const orderIds = orders.map((o) => o.id);
    let allItems = [];
    if (orderIds.length > 0) {
      allItems = await sql`
        SELECT * FROM order_items 
        WHERE order_id = ANY(${orderIds}::int[])
      `;
    }

    const ordersWithItems = orders.map((order) => ({
      ...order,
      order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
      items: allItems.filter((i) => i.order_id === order.id),
    }));

    return Response.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // 0. Rate limiting protection on order placement
    const clientIp = getClientIp(request);
    const rateCheck = rateLimiter.check(`checkout:${clientIp}`, 20, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return Response.json(
        { error: "Too many orders submitted in a short time. Please wait a few moments before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
        }
      );
    }

    const session = await auth();
    const body = await request.json();

    const {
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      shipping_city,
      shipping_pincode,
      payment_method,
      items,
      promo_code,
      redeem_points,
      prescription_id,
      gentle_delivery,
      delivery_instructions,
    } = body;

    // 1. Validate customer inputs
    const cleanEmail = sanitizeText(customer_email, 255).toLowerCase();
    const cleanPhone = sanitizeText(customer_phone, 20);
    const cleanName = sanitizeText(customer_name, 100);
    const cleanAddress = sanitizeText(shipping_address, 500);
    const cleanCity = sanitizeText(shipping_city, 100) || "Hyderabad";
    const cleanPincode = sanitizeText(shipping_pincode, 20);

    if (!validateEmail(cleanEmail)) {
      return Response.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (!validatePhone(cleanPhone)) {
      return Response.json({ error: "A valid contact phone number is required." }, { status: 400 });
    }

    if (!cleanName || !cleanAddress || !cleanPincode) {
      return Response.json({ error: "Complete delivery address and pincode are required." }, { status: 400 });
    }

    // 2. Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Your cart is empty." }, { status: 400 });
    }

    // 3. Resolve user ID
    let userId = session?.user?.id;
    if (!userId) {
      const existingUsers = await sql`
        SELECT id FROM auth_users WHERE email = ${cleanEmail} LIMIT 1
      `;
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        const newUsers = await sql`
          INSERT INTO auth_users (name, email, role)
          VALUES (${cleanName}, ${cleanEmail}, 'customer')
          RETURNING id
        `;
        userId = newUsers[0].id;
      }
    }

    // 4. Verify live stock, variant prices, prescriptions, offers & loyalty redemption
    const validation = await validateCheckoutPayload({
      items,
      promoCode: promo_code,
      userId,
      customerEmail: cleanEmail,
      redeemPoints: redeem_points || 0,
      prescriptionId: prescription_id || null,
    });

    if (!validation.valid) {
      return Response.json(
        { error: validation.error, requiresPrescription: Boolean(validation.requiresPrescription) },
        { status: validation.status || 400 }
      );
    }

    const verifiedSubtotal = validation.subtotal;
    const finalOrderItems = validation.verifiedItems;

    // 4.5 Verify Delivery Serviceability to Customer Pincode
    const serviceability = await checkServiceability(cleanPincode, verifiedSubtotal);
    if (!serviceability.serviceable) {
      logger.warn("unserviceable_checkout_rejected", "Checkout rejected for unserviceable pincode", {
        pincode: cleanPincode,
        email: cleanEmail,
      });
      return Response.json(
        { error: serviceability.reason || `Doorstep delivery is currently not available to pincode ${cleanPincode}.` },
        { status: 400 }
      );
    }

    const deliveryCharge = serviceability.deliveryCharge;
    const discount = validation.offerDiscount || 0;
    const pointsDiscount = validation.pointsDiscount || 0;
    const pointsRedeemed = validation.pointsToRedeem || 0;

    const finalTotal = Math.max(
      1,
      Math.round(verifiedSubtotal + deliveryCharge - discount - pointsDiscount)
    );

    // For COD: payment_status is strictly 'pending', status is 'placed'
    // Server enforces payment security: client cannot pass 'paid' for COD orders
    const paymentMethod = payment_method === "cod" ? "cod" : "cod";
    const paymentStatus = "pending";
    const orderStatus =
      validation.requiresPrescription && validation.verifiedPrescription?.status !== "approved"
        ? ORDER_STATUS.PRESCRIPTION_REVIEW
        : ORDER_STATUS.PLACED;

    // 5. Create Order
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
    const isGentleDelivery = Boolean(gentle_delivery);
    const cleanInstructions = sanitizeText(delivery_instructions || "", 300) || null;

    const newOrders = await sql`
      INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_intent_id, payment_status, status,
        delivery_distance, delivery_charge, payment_method,
        offer_code, offer_discount, points_redeemed, points_discount,
        prescription_required, prescription_status,
        delivery_otp, gentle_delivery, delivery_instructions
      ) VALUES (
        ${userId}, ${cleanName}, ${cleanEmail}, ${cleanPhone},
        ${cleanAddress}, ${cleanCity}, ${cleanPincode},
        ${finalTotal}, NULL, ${paymentStatus}, ${orderStatus},
        0, ${deliveryCharge}, ${paymentMethod},
        ${validation.offer?.code || null}, ${discount}, ${pointsRedeemed}, ${pointsDiscount},
        ${validation.requiresPrescription}, ${validation.verifiedPrescription?.status || null},
        ${deliveryOtp}, ${isGentleDelivery}, ${cleanInstructions}
      )
      RETURNING *
    `;

    const order = newOrders[0];
    const orderNumber = `SU-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;

    await sql`UPDATE orders SET order_number = ${orderNumber} WHERE id = ${order.id}`;
    order.order_number = orderNumber;

    // 6. Insert order items & atomically deduct stock with movement history
    for (const item of finalOrderItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, variant_id, variant_name, product_name, product_image, quantity, price)
        VALUES (${order.id}, ${item.product_id}, ${item.variant_id || null}, ${item.variant_name || null}, ${item.name}, ${item.image_url}, ${item.quantity}, ${item.price})
      `;
    }

    await deductVerifiedOrderStock({
      verifiedItems: finalOrderItems,
      orderId: order.id,
      userId,
      userName: cleanName,
    });

    if (validation.offer?.id) {
      await recordOfferRedemption({
        offerId: validation.offer.id,
        userId,
        customerEmail: cleanEmail,
        orderId: order.id,
        discountAmount: discount,
      });
    }

    if (pointsRedeemed > 0) {
      await commitPointRedemption({
        userId,
        orderId: order.id,
        pointsToRedeem: pointsRedeemed,
        orderNumber,
      });
    }

    if (validation.verifiedPrescription?.id) {
      await sql`
        UPDATE prescriptions SET order_id = ${order.id} WHERE id = ${validation.verifiedPrescription.id}
      `;
    }

    // 6.5. Record initial timeline in order_status_history
    await sql`
      INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
      VALUES (${order.id}, ${orderStatus}, ${userId}, 'customer', 'Order placed by customer via Cash on Delivery')
    `;

    // 7. Trigger Multi-Channel Notifications (Admin Alert + Customer Email/SMS Log)
    await triggerOrderNotifications(NOTIFICATION_TYPES.NEW_ORDER, order);

    // 8. Clear user DB cart if authenticated
    if (session?.user?.id) {
      await sql`DELETE FROM cart_items WHERE user_id = ${session.user.id}`;
    }

    logger.info("cod_order_placed_success", `COD Order ${orderNumber} placed for ₹${finalTotal}`, {
      orderId: order.id,
      orderNumber,
      itemCount: finalOrderItems.length,
      pincode: cleanPincode,
    });

    return Response.json({
      success: true,
      message: "Order placed successfully.",
      order: {
        ...order,
        items: finalOrderItems,
      },
    });
  } catch (error) {
    logger.error("order_creation_failed", "Failed to place customer order", error);
    return Response.json(
      { error: "Failed to place order. " + error.message },
      { status: 500 }
    );
  }
}
