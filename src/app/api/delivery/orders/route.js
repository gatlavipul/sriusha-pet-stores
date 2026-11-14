import sql from "@/app/api/utils/sql";
import { requireDeliveryPartner } from "@/app/api/utils/security";

export async function GET(req) {
  try {
    const authResult = await requireDeliveryPartner(req);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partnerId = authResult.user.id;
    const isAdmin = Boolean(authResult.isAdmin);

    let orders;
    if (isAdmin) {
      // Admins opening /delivery can view all orders across delivery stages
      orders = await sql`
        SELECT 
          o.*,
          o.order_number,
          dp.name as assigned_partner_name,
          dp.email as assigned_partner_email
        FROM orders o
        LEFT JOIN auth_users dp ON dp.id = o.assigned_delivery_partner_id
        WHERE o.status IN ('assigned', 'ready_for_delivery', 'packed', 'confirmed', 'out_for_delivery', 'delivered')
        ORDER BY 
          CASE 
            WHEN o.status = 'out_for_delivery' THEN 1
            WHEN o.status IN ('assigned', 'ready_for_delivery', 'packed', 'confirmed') THEN 2
            WHEN o.status = 'delivered' THEN 3
            ELSE 4
          END,
          o.created_at DESC
      `;
    } else {
      // Delivery partners can ONLY view orders assigned to them
      orders = await sql`
        SELECT 
          o.*,
          o.order_number
        FROM orders o
        WHERE o.assigned_delivery_partner_id = ${partnerId}
        ORDER BY 
          CASE 
            WHEN o.status = 'out_for_delivery' THEN 1
            WHEN o.status IN ('assigned', 'ready_for_delivery', 'packed', 'confirmed') THEN 2
            WHEN o.status = 'delivered' THEN 3
            ELSE 4
          END,
          o.created_at DESC
      `;
    }

    const orderIds = orders.map((o) => o.id);
    let items = [];
    let histories = [];

    if (orderIds.length > 0) {
      items = await sql`
        SELECT id, order_id, product_name, variant_name, quantity, price, image_url
        FROM order_items 
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

    const ordersWithDetails = orders.map((order) => {
      const orderItems = items.filter((i) => i.order_id === order.id);
      const itemsSummary = orderItems.length > 0
        ? orderItems.map((i) => `${i.product_name || "Item"}${i.variant_name ? ` (${i.variant_name})` : ""} × ${i.quantity}`).join(", ")
        : "Order Package";

      return {
        id: order.id,
        order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
        status: order.status,
        payment_method: order.payment_method || "cod",
        payment_status: order.payment_status || "pending",
        total_amount: Number(order.total_amount || 0),
        customer_name: order.customer_name || "Customer",
        customer_phone: order.customer_phone || "",
        shipping_address: order.shipping_address || "",
        shipping_city: order.shipping_city || "Hyderabad",
        shipping_pincode: order.shipping_pincode || "",
        delivery_distance: order.delivery_distance,
        picked_up_at: order.picked_up_at || null,
        delivered_at: order.delivered_at || null,
        created_at: order.created_at,
        updated_at: order.updated_at,
        assigned_delivery_partner_id: order.assigned_delivery_partner_id,
        assigned_partner_name: order.assigned_partner_name || null,
        itemsSummary,
        items: orderItems,
        history: histories.filter((h) => h.order_id === order.id),
      };
    });

    return Response.json({
      orders: ordersWithDetails,
      isAdmin,
      partner: {
        id: authResult.user.id,
        name: authResult.user.name,
        email: authResult.user.email,
        role: authResult.user.role,
      },
    });
  } catch (error) {
    console.error("Error in delivery orders GET:", error);
    return Response.json({ error: "Failed to fetch delivery orders" }, { status: 500 });
  }
}
