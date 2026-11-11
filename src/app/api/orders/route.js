import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

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

    return Response.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
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
      payment_intent_id,
      delivery_distance,
      delivery_charge,
      payment_method,
      total_amount,
      items,
    } = body;

    let userId = session?.user?.id;

    // If not logged in, find or create customer by email
    if (!userId) {
      if (!customer_email) {
        return Response.json(
          { error: "Customer email is required" },
          { status: 400 }
        );
      }
      const existingUsers = await sql`
        SELECT id FROM auth_users WHERE email = ${customer_email.toLowerCase().trim()} LIMIT 1
      `;
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        const newUsers = await sql`
          INSERT INTO auth_users (name, email, role)
          VALUES (${customer_name || 'Customer'}, ${customer_email.toLowerCase().trim()}, 'customer')
          RETURNING id
        `;
        userId = newUsers[0].id;
      }
    }

    // Determine order items: from client items array or server cart
    let orderItemList = [];
    if (items && Array.isArray(items) && items.length > 0) {
      orderItemList = items.map((it) => ({
        product_id: it.product_id || it.id,
        name: it.name,
        price: it.price,
        image_url: it.image_url,
        quantity: it.quantity || 1,
      }));
    } else {
      const dbCartItems = await sql`
        SELECT c.*, p.name, p.price, p.image_url 
        FROM cart_items c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.user_id = ${userId}
      `;
      orderItemList = dbCartItems.map((it) => ({
        product_id: it.product_id,
        name: it.name,
        price: it.price,
        image_url: it.image_url,
        quantity: it.quantity,
      }));
    }

    if (orderItemList.length === 0) {
      return Response.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Calculate final total
    const computedItemsTotal = orderItemList.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    const finalTotal = total_amount ? parseFloat(total_amount) : computedItemsTotal + (delivery_charge || 0);

    // Create order
    const orders = await sql`
      INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode, 
        total_amount, payment_intent_id, payment_status, status,
        delivery_distance, delivery_charge, payment_method
      ) VALUES (
        ${userId}, ${customer_name}, ${customer_email}, ${customer_phone},
        ${shipping_address}, ${shipping_city}, ${shipping_pincode},
        ${finalTotal}, ${payment_intent_id || null}, 
        ${payment_intent_id ? "paid" : "pending"}, 
        ${payment_method === 'cod' ? 'processing' : 'confirmed'},
        ${delivery_distance || 0}, ${delivery_charge || 0}, ${payment_method || 'razorpay'}
      )
      RETURNING *
    `;

    const order = orders[0];

    // Create order items
    for (const item of orderItemList) {
      await sql`
        INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price)
        VALUES (${order.id}, ${item.product_id}, ${item.name}, ${item.image_url}, ${item.quantity}, ${item.price})
      `;
    }

    // Clear DB cart if user is authenticated
    if (session?.user?.id) {
      await sql`DELETE FROM cart_items WHERE user_id = ${session.user.id}`;
    }

    return Response.json({ order });
  } catch (error) {
    console.error("Error creating order:", error);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}
