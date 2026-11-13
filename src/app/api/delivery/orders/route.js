import sql from "@/app/api/utils/sql";
import { requireDeliveryPartner } from "@/app/api/utils/security";

export async function GET(req) {
  try {
    const authResult = await requireDeliveryPartner(req);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partnerId = authResult.user.id;

    // Delivery partners can ONLY view orders assigned to them
    const orders = await sql`
      SELECT 
        o.*,
        o.order_number
      FROM orders o
      WHERE o.assigned_delivery_partner_id = ${partnerId}
      ORDER BY 
        CASE 
          WHEN o.status = 'out_for_delivery' THEN 1
          WHEN o.status = 'assigned' OR o.status = 'ready_for_delivery' THEN 2
          WHEN o.status = 'delivered' THEN 3
          ELSE 4
        END,
        o.created_at DESC
    `;

    const orderIds = orders.map((o) => o.id);
    let items = [];
    let histories = [];

    if (orderIds.length > 0) {
      items = await sql`
        SELECT * FROM order_items 
        WHERE order_id = ANY(${orderIds}::int[])
      `;

      histories = await sql`
        SELECT h.*, u.name as changed_by_name
        FROM order_status_history h
        LEFT JOIN auth_users u ON u.id = h.changed_by_user_id
        WHERE h.order_id = ANY(${orderIds}::int[])
        ORDER BY h.created_at ASC
      `;
    }

    const ordersWithDetails = orders.map((order) => ({
      ...order,
      order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
      items: items.filter((i) => i.order_id === order.id),
      history: histories.filter((h) => h.order_id === order.id),
    }));

    return Response.json({
      orders: ordersWithDetails,
      partner: {
        id: authResult.user.id,
        name: authResult.user.name,
        email: authResult.user.email,
      },
    });
  } catch (error) {
    console.error("Error in delivery orders GET:", error);
    return Response.json({ error: "Failed to fetch delivery orders" }, { status: 500 });
  }
}

