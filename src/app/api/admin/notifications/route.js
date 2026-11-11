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
    const type = searchParams.get("type");
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    let query = `SELECT * FROM admin_notifications WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (type && type !== "all") {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (unreadOnly) {
      query += ` AND is_read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const notifications = await sql(query, params);

    // Unread count total
    const unreadRes = await sql`
      SELECT COUNT(*)::int as count FROM admin_notifications WHERE is_read = FALSE
    `;
    const unreadCount = unreadRes[0]?.count || 0;

    // Type breakdown summary
    const summaryRes = await sql`
      SELECT type, COUNT(*)::int as count 
      FROM admin_notifications 
      WHERE is_read = FALSE 
      GROUP BY type
    `;

    const summary = {};
    summaryRes.forEach((row) => {
      summary[row.type] = row.count;
    });

    return Response.json({
      notifications,
      unreadCount,
      summary,
    });
  } catch (error) {
    logger.error("admin_notifications_get_error", "Failed to fetch admin notifications", error);
    return Response.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === "mark_all_read") {
      await sql`UPDATE admin_notifications SET is_read = TRUE WHERE is_read = FALSE`;
      logger.info("admin_notifications_mark_all_read", `Admin ${authResult.user.id} marked all notifications as read`);
      return Response.json({ success: true, message: "All notifications marked as read." });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logger.error("admin_notifications_put_error", "Failed to update notifications", error);
    return Response.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

