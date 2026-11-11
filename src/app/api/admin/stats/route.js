import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    // 1. Total active products
    const totalProducts = await sql`
      SELECT COUNT(*)::int as count FROM products WHERE is_active = true
    `;

    // 2. Low stock products (5 or fewer in stock)
    const lowStockProducts = await sql`
      SELECT COUNT(*)::int as count FROM products WHERE is_active = true AND stock_quantity <= 5
    `;

    // 3. Total orders count
    const totalOrders = await sql`
      SELECT COUNT(*)::int as count FROM orders
    `;

    // 4. Pending / active orders count in progress
    const pendingOrders = await sql`
      SELECT COUNT(*)::int as count FROM orders 
      WHERE status IN ('placed', 'confirmed', 'packing', 'ready_for_delivery', 'assigned', 'out_for_delivery', 'pending', 'processing')
    `;

    // 5. Total customers count
    const totalCustomers = await sql`
      SELECT COUNT(*)::int as count FROM auth_users WHERE role = 'customer'
    `;

    // 6. Total revenue (strictly excluding cancelled, refunded, or failed orders)
    const revenueRes = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM orders 
      WHERE status NOT IN ('cancelled', 'failed')
        AND (payment_status = 'paid' OR (payment_method = 'cod' AND status = 'delivered'))
    `;

    // 7. Delivery exceptions count (orders marked delivery_failed)
    const deliveryExceptions = await sql`
      SELECT COUNT(*)::int as count FROM orders WHERE status = 'delivery_failed'
    `;

    // 8. Unread admin notifications count
    const unreadNotifications = await sql`
      SELECT COUNT(*)::int as count FROM admin_notifications WHERE is_read = false
    `;

    // 9. Recent orders with items count
    const recentOrders = await sql`
      SELECT 
        o.id,
        COALESCE(o.order_number, 'SU-2026-' || LPAD(o.id::text, 4, '0')) as order_number,
        o.customer_name,
        o.customer_email,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.status,
        o.created_at,
        COUNT(oi.id)::int as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 8
    `;

    return Response.json({
      stats: {
        totalProducts: totalProducts[0]?.count || 0,
        lowStockProducts: lowStockProducts[0]?.count || 0,
        totalOrders: totalOrders[0]?.count || 0,
        pendingOrders: pendingOrders[0]?.count || 0,
        totalCustomers: totalCustomers[0]?.count || 0,
        totalRevenue: parseFloat(revenueRes[0]?.total || 0),
        deliveryExceptions: deliveryExceptions[0]?.count || 0,
        unreadNotifications: unreadNotifications[0]?.count || 0,
      },
      recentOrders,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
