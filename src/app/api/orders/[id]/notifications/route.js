import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import logger from "@/utils/logger";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    const { id } = params;

    const orders = await sql`SELECT user_id, customer_email FROM orders WHERE id = ${id} LIMIT 1`;
    if (orders.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orders[0];

    // Check authorization: must be order owner or admin
    let isAuthorized = false;
    if (session?.user?.id) {
      if (order.user_id === session.user.id) {
        isAuthorized = true;
      } else {
        const adminCheck = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id} LIMIT 1`;
        if (adminCheck[0]?.role === "admin") {
          isAuthorized = true;
        }
      }
    }

    // Optional query param matching guest email
    const { searchParams } = new URL(request.url);
    const guestEmail = searchParams.get("email");
    if (guestEmail && guestEmail.toLowerCase().trim() === order.customer_email.toLowerCase()) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await sql`
      SELECT id, channel, template_type, title, content, status, created_at
      FROM customer_notifications
      WHERE order_id = ${id}
      ORDER BY created_at ASC
    `;

    return Response.json({ notifications });
  } catch (error) {
    logger.error("customer_order_notifications_error", "Failed to fetch customer notifications", error);
    return Response.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

