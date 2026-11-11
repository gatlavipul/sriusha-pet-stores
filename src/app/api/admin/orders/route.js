import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        o.*,
        dp.name as delivery_partner_name,
        dp.email as delivery_partner_email
      FROM orders o
      LEFT JOIN auth_users dp ON o.assigned_delivery_partner_id = dp.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (
        LOWER(COALESCE(o.order_number, '')) LIKE LOWER($${paramIndex}) OR
        LOWER(COALESCE(o.customer_name, '')) LIKE LOWER($${paramIndex}) OR
        LOWER(COALESCE(o.customer_email, '')) LIKE LOWER($${paramIndex}) OR
        COALESCE(o.customer_phone, '') LIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (status && status !== "all") {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (paymentStatus && paymentStatus !== "all") {
      query += ` AND o.payment_status = $${paramIndex}`;
      params.push(paymentStatus);
      paramIndex++;
    }

    // Total count for pagination
    const countQuery = `SELECT COUNT(*)::int as total FROM (${query}) AS filtered_tbl`;
    const countRes = await sql(countQuery, params);
    const totalCount = countRes[0]?.total || 0;

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const orders = await sql(query, params);

    // Fetch items for all returned orders
    const orderIds = orders.map((o) => o.id);
    let allItems = [];
    if (orderIds.length > 0) {
      allItems = await sql`
        SELECT * FROM order_items 
        WHERE order_id = ANY(${orderIds}::int[])
      `;
    }

    // Attach items to each order
    const ordersWithItems = orders.map((order) => ({
      ...order,
      order_number: order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`,
      items: allItems.filter((item) => item.order_id === order.id),
    }));

    return Response.json({
      orders: ordersWithItems,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
