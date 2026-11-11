import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    const { id } = params;

    let orders;
    if (session?.user?.id) {
      // Check if user is admin or owner
      const userCheck = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
      const isAdmin = userCheck[0]?.role === 'admin';

      if (isAdmin) {
        orders = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      } else {
        orders = await sql`
          SELECT * FROM orders 
          WHERE id = ${id} AND user_id = ${session.user.id}
          LIMIT 1
        `;
      }
    } else {
      // Allow fetching recently placed order for receipt display
      orders = await sql`
        SELECT * FROM orders 
        WHERE id = ${id}
        LIMIT 1
      `;
    }

    if (!orders || orders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const items = await sql`
      SELECT * FROM order_items 
      WHERE order_id = ${id}
    `;

    return Response.json({ order: { ...orders[0], items } });
  } catch (error) {
    console.error("Error fetching order:", error);
    return Response.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
