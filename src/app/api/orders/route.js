import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { validateEmail, validatePhone, sanitizeText } from "@/app/api/utils/security";

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

    // 4. Verify stock and calculate authentic total from database
    const productIds = items
      .map((it) => parseInt(it.product_id || it.id, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    const dbProducts = await sql`
      SELECT id, name, price, sale_price, stock_quantity, image_url, is_active
      FROM products
      WHERE id = ANY(${productIds}::int[])
    `;

    const prodMap = new Map();
    dbProducts.forEach((p) => prodMap.set(p.id, p));

    let verifiedSubtotal = 0;
    const finalOrderItems = [];

    // Check stock for all items BEFORE making any changes
    for (const item of items) {
      const pid = parseInt(item.product_id || item.id, 10);
      const dbProd = prodMap.get(pid);

      if (!dbProd || !dbProd.is_active) {
        return Response.json(
          { error: `Product "${item.name || 'Selected item'}" is currently unavailable.` },
          { status: 400 }
        );
      }

      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      if (dbProd.stock_quantity < qty) {
        return Response.json(
          {
            error: `Insufficient stock for "${dbProd.name}". Only ${dbProd.stock_quantity} unit(s) available.`,
          },
          { status: 400 }
        );
      }

      const unitPrice = parseFloat(dbProd.sale_price || dbProd.price);
      verifiedSubtotal += unitPrice * qty;
      finalOrderItems.push({
        product_id: dbProd.id,
        name: dbProd.name,
        price: unitPrice,
        image_url: dbProd.image_url,
        quantity: qty,
      });
    }

    // Atomically decrement stock
    for (const item of finalOrderItems) {
      await sql`
        UPDATE products 
        SET stock_quantity = GREATEST(0, stock_quantity - ${item.quantity}), updated_at = NOW()
        WHERE id = ${item.product_id}
      `;
    }

    const deliveryCharge = verifiedSubtotal >= 500 ? 0 : 40;
    let discount = 0;
    if (promo_code) {
      const code = String(promo_code).toUpperCase().trim();
      if (code === "USHA10") discount = Math.round(verifiedSubtotal * 0.1);
      else if (code === "FLAT50") discount = Math.min(50, verifiedSubtotal);
    }

    const finalTotal = Math.max(1, Math.round(verifiedSubtotal + deliveryCharge - discount));

    // For COD: payment_status is strictly 'pending', status is 'processing'
    // Server enforces payment security: client cannot pass 'paid' for COD orders
    const paymentMethod = payment_method === "cod" ? "cod" : "cod";
    const paymentStatus = "pending";
    const orderStatus = "processing";

    // 5. Create Order
    const newOrders = await sql`
      INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_intent_id, payment_status, status,
        delivery_distance, delivery_charge, payment_method
      ) VALUES (
        ${userId}, ${cleanName}, ${cleanEmail}, ${cleanPhone},
        ${cleanAddress}, ${cleanCity}, ${cleanPincode},
        ${finalTotal}, NULL, ${paymentStatus}, ${orderStatus},
        0, ${deliveryCharge}, ${paymentMethod}
      )
      RETURNING *
    `;

    const order = newOrders[0];
    const orderNumber = `SU-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;

    await sql`UPDATE orders SET order_number = ${orderNumber} WHERE id = ${order.id}`;
    order.order_number = orderNumber;

    // 6. Insert order items
    for (const item of finalOrderItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price)
        VALUES (${order.id}, ${item.product_id}, ${item.name}, ${item.image_url}, ${item.quantity}, ${item.price})
      `;
    }

    // 6.5. Record initial timeline in order_status_history
    await sql`
      INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
      VALUES (${order.id}, ${orderStatus}, ${userId}, 'customer', 'Order placed by customer via Cash on Delivery')
    `;

    // 7. Clear user DB cart if authenticated
    if (session?.user?.id) {
      await sql`DELETE FROM cart_items WHERE user_id = ${session.user.id}`;
    }

    return Response.json({
      success: true,
      message: "Order placed successfully.",
      order: {
        ...order,
        items: finalOrderItems,
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return Response.json(
      { error: "Failed to place order. " + error.message },
      { status: 500 }
    );
  }
}
