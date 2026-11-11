import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const guestEmail = searchParams.get("email");

    let orders;
    if (session?.user?.id) {
      // Check user role from database
      const userCheck = await sql`
        SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1
      `;
      const role = userCheck[0]?.role || "customer";

      if (role === "admin") {
        orders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      } else if (role === "delivery_partner") {
        orders = await sql`
          SELECT * FROM orders 
          WHERE id = ${id} AND assigned_delivery_partner_id = ${session.user.id}
          LIMIT 1
        `;
      } else {
        orders = await sql`
          SELECT * FROM orders 
          WHERE id = ${id} AND user_id = ${session.user.id}
          LIMIT 1
        `;
      }
    } else if (guestEmail) {
      // Guest verified by email match
      orders = await sql`
        SELECT * FROM orders 
        WHERE id = ${id} AND LOWER(customer_email) = ${guestEmail.toLowerCase().trim()}
        LIMIT 1
      `;
    } else {
      // Recent order receipt display (allowed for recently placed orders within 2 hours)
      orders = await sql`
        SELECT * FROM orders 
        WHERE id = ${id} AND created_at > NOW() - INTERVAL '2 hours'
        LIMIT 1
      `;
    }

    if (!orders || orders.length === 0) {
      return Response.json({ error: "Order not found or access unauthorized" }, { status: 404 });
    }

    const order = orders[0];
    const items = await sql`
      SELECT * FROM order_items 
      WHERE order_id = ${id}
    `;

    // Fetch public order status timeline
    const history = await sql`
      SELECT h.id, h.status, h.changed_by_role, h.notes, h.created_at
      FROM order_status_history h
      WHERE h.order_id = ${id}
      ORDER BY h.created_at ASC
    `;

    return Response.json({
      order: {
        ...order,
        order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
        items,
        history,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return Response.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
