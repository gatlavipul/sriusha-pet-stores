import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import crypto from "crypto";
import { validateEmail, validatePhone, sanitizeText } from "@/app/api/utils/security";

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
      console.error("Signature mismatch: received vs expected", razorpay_signature, expectedSignature);
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

    // 5. Verify live products, compute total, check & decrement stock atomically
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "No items to order." }, { status: 400 });
    }

    const productIds = items
      .map((it) => parseInt(it.product_id || it.id, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    const dbProducts = await sql`
      SELECT id, name, price, sale_price, stock_quantity, image_url
      FROM products
      WHERE id = ANY(${productIds}::int[])
    `;

    const prodMap = new Map();
    dbProducts.forEach((p) => prodMap.set(p.id, p));

    let verifiedSubtotal = 0;
    const finalOrderItems = [];

    for (const item of items) {
      const pid = parseInt(item.product_id || item.id, 10);
      const dbProd = prodMap.get(pid);
      if (!dbProd) {
        return Response.json({ error: `Product ID ${pid} not found.` }, { status: 400 });
      }

      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      const unitPrice = parseFloat(dbProd.sale_price || dbProd.price);

      verifiedSubtotal += unitPrice * qty;
      finalOrderItems.push({
        product_id: dbProd.id,
        name: dbProd.name,
        price: unitPrice,
        image_url: dbProd.image_url,
        quantity: qty,
      });

      // Atomically decrement stock
      await sql`
        UPDATE products 
        SET stock_quantity = GREATEST(0, stock_quantity - ${qty}), updated_at = NOW()
        WHERE id = ${dbProd.id}
      `;
    }

    const validDeliveryCharge = verifiedSubtotal >= 500 ? 0 : 40;
    let promoDiscount = 0;
    if (promo_code) {
      const code = String(promo_code).toUpperCase().trim();
      if (code === "USHA10") promoDiscount = Math.round(verifiedSubtotal * 0.1);
      else if (code === "FLAT50") promoDiscount = Math.min(50, verifiedSubtotal);
    }

    const calculatedTotal = Math.max(1, Math.round(verifiedSubtotal + validDeliveryCharge - promoDiscount));

    // 6. Generate order and unique order number
    const newOrders = await sql`
      INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_intent_id, payment_status, status,
        delivery_distance, delivery_charge, payment_method,
        razorpay_order_id, razorpay_signature
      ) VALUES (
        ${userId}, ${cleanName}, ${cleanEmail}, ${cleanPhone},
        ${cleanAddress}, ${cleanCity || "Hyderabad"}, ${cleanPincode},
        ${calculatedTotal}, ${razorpay_payment_id}, 'paid', 'confirmed',
        0, ${validDeliveryCharge}, 'razorpay',
        ${razorpay_order_id}, ${razorpay_signature}
      )
      RETURNING *
    `;

    const order = newOrders[0];
    const orderNumber = `SU-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;

    await sql`UPDATE orders SET order_number = ${orderNumber} WHERE id = ${order.id}`;
    order.order_number = orderNumber;

    // 7. Insert order items
    for (const item of finalOrderItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price)
        VALUES (${order.id}, ${item.product_id}, ${item.name}, ${item.image_url}, ${item.quantity}, ${item.price})
      `;
    }

    // 7.5. Record initial timeline in order_status_history
    await sql`
      INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
      VALUES (${order.id}, 'confirmed', ${userId}, 'customer', 'Payment verified via Razorpay online gateway')
    `;

    // 8. Clear DB cart if logged in
    if (session?.user?.id) {
      await sql`DELETE FROM cart_items WHERE user_id = ${session.user.id}`;
    }

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

