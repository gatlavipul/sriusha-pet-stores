import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";
import logger from "@/utils/logger";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");

    // 1. Compute date range filter clause
    let dateFilterClause = "";
    const filterParams = [];
    let pIdx = 1;

    const now = new Date();
    if (range === "today") {
      dateFilterClause = ` AND o.created_at >= CURRENT_DATE`;
    } else if (range === "7d") {
      dateFilterClause = ` AND o.created_at >= (NOW() - INTERVAL '7 days')`;
    } else if (range === "30d") {
      dateFilterClause = ` AND o.created_at >= (NOW() - INTERVAL '30 days')`;
    } else if (range === "this_month") {
      dateFilterClause = ` AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom" && customStart && customEnd) {
      dateFilterClause = ` AND o.created_at >= $${pIdx}::timestamp AND o.created_at <= $${pIdx + 1}::timestamp`;
      filterParams.push(new Date(customStart).toISOString(), new Date(customEnd).toISOString());
      pIdx += 2;
    }

    // 2. Total orders and breakdown by status in range
    const ordersByStatusQuery = `
      SELECT o.status, COUNT(*)::int as count 
      FROM orders o
      WHERE 1=1 ${dateFilterClause}
      GROUP BY o.status
    `;
    const ordersByStatusRes = await sql(ordersByStatusQuery, filterParams);
    const statusCounts = {};
    let totalOrdersInRange = 0;
    ordersByStatusRes.forEach((row) => {
      statusCounts[row.status] = row.count;
      totalOrdersInRange += row.count;
    });

    // 3. Valid Completed Revenue Calculation
    // EXCLUDES: cancelled, refunded, failed, and uncollected COD orders
    // INCLUDES: (payment_status = 'paid' AND status != 'cancelled')
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(o.total_amount), 0)::numeric as total_revenue,
        COUNT(*)::int as paid_orders_count
      FROM orders o
      WHERE 1=1 ${dateFilterClause}
        AND o.status NOT IN ('cancelled', 'failed')
        AND (
          (o.payment_method != 'cod' AND o.payment_status = 'paid')
          OR 
          (o.payment_method = 'cod' AND o.status = 'delivered' AND o.payment_status = 'paid')
        )
    `;
    const revenueRes = await sql(revenueQuery, filterParams);
    const totalRevenue = parseFloat(revenueRes[0]?.total_revenue || 0);
    const paidOrdersCount = revenueRes[0]?.paid_orders_count || 0;
    const averageOrderValue = paidOrdersCount > 0 ? Math.round(totalRevenue / paidOrdersCount) : 0;

    // 4. Payment Method Breakdown (COD vs Online)
    const paymentBreakdownQuery = `
      SELECT 
        o.payment_method,
        COUNT(*)::int as count,
        COALESCE(SUM(CASE 
          WHEN (o.payment_method != 'cod' AND o.payment_status = 'paid')
            OR (o.payment_method = 'cod' AND o.status = 'delivered' AND o.payment_status = 'paid')
          THEN o.total_amount ELSE 0 
        END), 0)::numeric as completed_revenue
      FROM orders o
      WHERE 1=1 ${dateFilterClause} AND o.status NOT IN ('cancelled', 'failed')
      GROUP BY o.payment_method
    `;
    const paymentBreakdownRes = await sql(paymentBreakdownQuery, filterParams);
    const paymentStats = {
      cod: { count: 0, revenue: 0 },
      online: { count: 0, revenue: 0 },
    };
    paymentBreakdownRes.forEach((row) => {
      if (row.payment_method === "cod") {
        paymentStats.cod = { count: row.count, revenue: parseFloat(row.completed_revenue) };
      } else {
        paymentStats.online.count += row.count;
        paymentStats.online.revenue += parseFloat(row.completed_revenue);
      }
    });

    // 5. Delivery Performance (Success vs Failure Rates)
    const deliveredCount = statusCounts["delivered"] || 0;
    const failedCount = statusCounts["delivery_failed"] || 0;
    const totalCompletedDispatches = deliveredCount + failedCount;
    const deliverySuccessRate = totalCompletedDispatches > 0
      ? Math.round((deliveredCount / totalCompletedDispatches) * 100)
      : 100;
    const deliveryFailureRate = totalCompletedDispatches > 0
      ? Math.round((failedCount / totalCompletedDispatches) * 100)
      : 0;

    // 6. Sales Over Time (by Day)
    const dailySalesQuery = `
      SELECT 
        TO_CHAR(DATE_TRUNC('day', o.created_at), 'YYYY-MM-DD') as date_label,
        COUNT(*)::int as orders_count,
        COALESCE(SUM(CASE 
          WHEN (o.payment_method != 'cod' AND o.payment_status = 'paid')
            OR (o.payment_method = 'cod' AND o.status = 'delivered' AND o.payment_status = 'paid')
          THEN o.total_amount ELSE 0 
        END), 0)::numeric as daily_revenue
      FROM orders o
      WHERE 1=1 ${dateFilterClause} AND o.status NOT IN ('cancelled', 'failed')
      GROUP BY DATE_TRUNC('day', o.created_at)
      ORDER BY DATE_TRUNC('day', o.created_at) ASC
      LIMIT 31
    `;
    const dailySalesRes = await sql(dailySalesQuery, filterParams);
    const dailySales = dailySalesRes.map((r) => ({
      date: r.date_label,
      orders: r.orders_count,
      revenue: parseFloat(r.daily_revenue),
    }));

    // 7. Best-selling Products in Period
    const topProductsQuery = `
      SELECT 
        oi.product_id,
        oi.product_name,
        oi.product_image,
        SUM(oi.quantity)::int as total_sold,
        SUM(oi.quantity * oi.price)::numeric as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE 1=1 ${dateFilterClause} AND o.status NOT IN ('cancelled', 'failed')
      GROUP BY oi.product_id, oi.product_name, oi.product_image
      ORDER BY total_sold DESC
      LIMIT 5
    `;
    const topProductsRes = await sql(topProductsQuery, filterParams);

    // 8. Low-Stock Inventory Warning (< 5 items)
    const lowStockRes = await sql`
      SELECT id, name, price, stock_quantity, image_url
      FROM products
      WHERE is_active = TRUE AND stock_quantity <= 5
      ORDER BY stock_quantity ASC
      LIMIT 10
    `;

    return Response.json({
      range,
      overview: {
        totalRevenue,
        paidOrdersCount,
        totalOrdersInRange,
        averageOrderValue,
        deliverySuccessRate,
        deliveryFailureRate,
        deliveredCount,
        failedCount,
      },
      statusCounts,
      paymentStats,
      dailySales,
      topProducts: topProductsRes.map((p) => ({
        ...p,
        total_revenue: parseFloat(p.total_revenue),
      })),
      lowStockProducts: lowStockRes,
    });
  } catch (error) {
    logger.error("admin_analytics_get_error", "Failed to compute business analytics", error);
    return Response.json({ error: "Failed to generate business analytics" }, { status: 500 });
  }
}

