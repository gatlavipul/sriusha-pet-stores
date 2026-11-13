import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import crypto from "crypto";
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
import logger from "@/utils/logger";

export async function POST(request) {
  try {
    const session = await auth();
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      shipping_city,
      shipping_pincode,
      delivery_charge,
      items,
      promo_code,
      redeem_points,
      prescription_id,
      gentle_delivery,
      delivery_instructions,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json(
        { error: "Missing required payment verification tokens." },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return Response.json({ error: "Gateway secret not configured." }, { status: 500 });
    }

    // 1. Cryptographic HMAC SHA256 Signature Verification
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpay_signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      logger.error("razorpay_signature_mismatch", "Payment signature verification failed", null, {
        razorpay_order_id,
        razorpay_payment_id,
      });
      return Response.json(
        { error: "Payment signature verification failed. Untrusted payment transaction." },
        { status: 400 }
      );
    }

    // 2. Prevent Duplicate Order Submissions (Idempotency Check)
    const existingPayment = await sql`
      SELECT id, order_number FROM orders WHERE payment_intent_id = ${razorpay_payment_id} LIMIT 1
    `;
    if (existingPayment.length > 0) {
      return Response.json({
        success: true,
        message: "Order already registered",
        order: existingPayment[0],
      });
    }

    // 3. Validate customer inputs
    const cleanEmail = sanitizeText(customer_email, 255).toLowerCase();
    const cleanPhone = sanitizeText(customer_phone, 20);
    const cleanName = sanitizeText(customer_name, 100);
    const cleanAddress = sanitizeText(shipping_address, 500);
    const cleanCity = sanitizeText(shipping_city, 100);
    const cleanPincode = sanitizeText(shipping_pincode, 20);

    if (!validateEmail(cleanEmail)) {
      return Response.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (!validatePhone(cleanPhone)) {
      return Response.json({ error: "A valid phone number is required." }, { status: 400 });
    }

    if (!cleanName || !cleanAddress || !cleanPincode) {
      return Response.json({ error: "Complete delivery address is required." }, { status: 400 });
    }

    // 4. Resolve user ID (authenticated or create guest record)
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

    // 5. Verify live products, variant prices, prescriptions, offers & loyalty redemption
    const validation = await validateCheckoutPayload({
      items,
      promoCode: promo_code,
      userId,
      customerEmail: cleanEmail,
      redeemPoints: redeem_points || 0,
      prescriptionId: prescription_id || null,
    });

    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: validation.status || 400 });
    }

    const verifiedSubtotal = validation.subtotal;
    const finalOrderItems = validation.verifiedItems;

    // 5.5 Verify Delivery Serviceability
    const serviceability = await checkServiceability(cleanPincode, verifiedSubtotal);
    if (!serviceability.serviceable) {
      logger.warn("razorpay_unserviceable_pincode", "Verified order address not in serviceable zone", {
        pincode: cleanPincode,
        orderId: razorpay_order_id,
      });
      return Response.json(
        { error: serviceability.reason || `Pincode ${cleanPincode} is currently not serviceable.` },
        { status: 400 }
      );
    }

    const validDeliveryCharge = serviceability.deliveryCharge;
    const promoDiscount = validation.offerDiscount || 0;
    const pointsDiscount = validation.pointsDiscount || 0;
    const pointsRedeemed = validation.pointsToRedeem || 0;

    const calculatedTotal = Math.max(
      1,
      Math.round(verifiedSubtotal + validDeliveryCharge - promoDiscount - pointsDiscount)
    );

    const initialOrderStatus =
      validation.requiresPrescription && validation.verifiedPrescription?.status !== "approved"
        ? "prescription_review"
        : "confirmed";

    // 6. Generate order and unique order number
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
    const isGentleDelivery = Boolean(gentle_delivery);
    const cleanInstructions = sanitizeText(delivery_instructions || "", 300) || null;

    const newOrders = await sql`
      INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_intent_id, payment_status, status,
        delivery_distance, delivery_charge, payment_method,
        razorpay_order_id, razorpay_signature,
        offer_code, offer_discount, points_redeemed, points_discount,
        prescription_required, prescription_status,
        delivery_otp, gentle_delivery, delivery_instructions
      ) VALUES (
        ${userId}, ${cleanName}, ${cleanEmail}, ${cleanPhone},
        ${cleanAddress}, ${cleanCity || "Hyderabad"}, ${cleanPincode},
        ${calculatedTotal}, ${razorpay_payment_id}, 'paid', ${initialOrderStatus},
        0, ${validDeliveryCharge}, 'razorpay',
        ${razorpay_order_id}, ${razorpay_signature},
        ${validation.offer?.code || null}, ${promoDiscount}, ${pointsRedeemed}, ${pointsDiscount},
        ${validation.requiresPrescription}, ${validation.verifiedPrescription?.status || null},
        ${deliveryOtp}, ${isGentleDelivery}, ${cleanInstructions}
      )
      RETURNING *
    `;

    const order = newOrders[0];
    const orderNumber = `SU-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;

    await sql`UPDATE orders SET order_number = ${orderNumber} WHERE id = ${order.id}`;
    order.order_number = orderNumber;

    // 7. Insert order items & deduct stock with movement history
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
        discountAmount: promoDiscount,
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

    // 7.5. Record initial timeline in order_status_history
    await sql`
      INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
      VALUES (${order.id}, 'confirmed', ${userId}, 'customer', 'Payment verified via Razorpay online gateway')
    `;

    // 8. Trigger Notifications (Admin notification + Customer confirmation)
    await triggerOrderNotifications(NOTIFICATION_TYPES.ORDER_CONFIRMED, order);

    // 9. Clear DB cart if logged in
    if (session?.user?.id) {
      await sql`DELETE FROM cart_items WHERE user_id = ${session.user.id}`;
    }

    logger.info("razorpay_payment_verified", `Order ${orderNumber} verified and placed online for ₹${calculatedTotal}`, {
      orderId: order.id,
      orderNumber,
      paymentId: razorpay_payment_id,
    });

    return Response.json({
      success: true,
      message: "Payment successfully verified and order confirmed.",
      order,
    });
  } catch (error) {
    console.error("Error in verify payment:", error);
    return Response.json(
      { error: "Payment verification encountered an unexpected error: " + error.message },
      { status: 500 }
    );
  }
}

