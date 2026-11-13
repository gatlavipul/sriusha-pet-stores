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

    // 10. Order operations pipeline counts & Today at Sri Usha operations queries
    const [
      pipelineRows,
      lowStockList,
      failedOrdersList,
      paymentIssuesRes,
      todayCompletedRes,
      pendingPrescriptionsList,
      pendingPrescriptionsCountRes,
      pendingReviewsCountRes,
      openSupportCountRes,
      openSupportList,
    ] = await Promise.all([
        sql`
          SELECT
            COUNT(*) FILTER (WHERE status IN ('placed', 'pending'))::int as placed,
            COUNT(*) FILTER (WHERE status = 'confirmed')::int as confirmed,
            COUNT(*) FILTER (WHERE status IN ('packing', 'processing'))::int as packing,
            COUNT(*) FILTER (WHERE status IN ('ready_for_delivery', 'assigned'))::int as ready_for_delivery,
            COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int as out_for_delivery,
            COUNT(*) FILTER (WHERE status = 'delivered')::int as delivered,
            COUNT(*) FILTER (WHERE status = 'delivery_failed')::int as delivery_failed
          FROM orders
        `,
        sql`
          SELECT id, name, stock_quantity
          FROM products
          WHERE is_active = true AND stock_quantity <= 5
          ORDER BY stock_quantity ASC, id DESC
          LIMIT 5
        `,
        sql`
          SELECT
            id,
            COALESCE(order_number, 'SU-2026-' || LPAD(id::text, 4, '0')) as order_number,
            customer_name,
            delivery_failure_reason,
            updated_at
          FROM orders
          WHERE status = 'delivery_failed'
          ORDER BY updated_at DESC NULLS LAST, created_at DESC
          LIMIT 5
        `,
        sql`
          SELECT COUNT(*)::int as count
          FROM orders
          WHERE payment_status = 'failed'
            OR (payment_method = 'online' AND payment_status = 'pending' AND status NOT IN ('cancelled', 'failed'))
        `,
        sql`
          SELECT
            COUNT(*) FILTER (
              WHERE status = 'delivered'
                AND DATE(COALESCE(updated_at, created_at) AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
            )::int as delivered_today,
            COALESCE(SUM(total_amount) FILTER (
              WHERE status NOT IN ('cancelled', 'failed')
                AND (payment_status = 'paid' OR (payment_method = 'cod' AND status = 'delivered'))
                AND DATE(COALESCE(updated_at, created_at) AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
            ), 0) as revenue_today,
            COUNT(*) FILTER (
              WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
            )::int as orders_placed_today
          FROM orders
        `,
        sql`
          SELECT pr.id, pr.original_filename, pr.created_at, u.name as customer_name, o.order_number
          FROM prescriptions pr
          LEFT JOIN auth_users u ON pr.user_id = u.id
          LEFT JOIN orders o ON pr.order_id = o.id
          WHERE pr.status = 'pending'
          ORDER BY pr.created_at DESC
          LIMIT 5
        `,
        sql`SELECT COUNT(*)::int as count FROM prescriptions WHERE status = 'pending'`,
        sql`SELECT COUNT(*)::int as count FROM product_reviews WHERE status = 'pending'`,
        sql`SELECT COUNT(*)::int as count FROM support_tickets WHERE status = 'open'`,
        sql`
          SELECT t.id, t.subject, t.category, t.created_at, u.name as customer_name, o.order_number
          FROM support_tickets t
          JOIN auth_users u ON t.user_id = u.id
          LEFT JOIN orders o ON t.order_id = o.id
          WHERE t.status = 'open'
          ORDER BY t.created_at DESC
          LIMIT 5
        `,
      ]);

    const pipeline = pipelineRows?.[0] || {
      placed: 0,
      confirmed: 0,
      packing: 0,
      ready_for_delivery: 0,
      out_for_delivery: 0,
      delivered: 0,
      delivery_failed: 0,
    };

    const todayRow = todayCompletedRes?.[0] || {
      delivered_today: 0,
      revenue_today: 0,
      orders_placed_today: 0,
    };

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
      pipelineCounts: pipeline,
      todayStats: {
        attention: {
          failedDeliveriesCount: pipeline.delivery_failed || 0,
          failedDeliveries: failedOrdersList || [],
          lowStockCount: lowStockProducts[0]?.count || 0,
          lowStockItems: lowStockList || [],
          paymentIssuesCount: paymentIssuesRes?.[0]?.count || 0,
          pendingPrescriptionsCount: pendingPrescriptionsCountRes?.[0]?.count || 0,
          pendingPrescriptionsList: pendingPrescriptionsList || [],
          pendingReviewsCount: pendingReviewsCountRes?.[0]?.count || 0,
          openSupportCount: openSupportCountRes?.[0]?.count || 0,
          openSupportList: openSupportList || [],
        },
        inProgress: {
          placedAndConfirmed: (pipeline.placed || 0) + (pipeline.confirmed || 0),
          packing: pipeline.packing || 0,
          readyForDelivery: pipeline.ready_for_delivery || 0,
          outForDelivery: pipeline.out_for_delivery || 0,
        },
        completedToday: {
          deliveredToday: todayRow.delivered_today || 0,
          revenueToday: parseFloat(todayRow.revenue_today || 0),
          ordersPlacedToday: todayRow.orders_placed_today || 0,
        },
      },
      recentOrders,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
