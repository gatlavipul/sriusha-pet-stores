import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";
import logger from "@/utils/logger";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const isRead = body.is_read !== undefined ? Boolean(body.is_read) : true;

    const updated = await sql`
      UPDATE admin_notifications 
      SET is_read = ${isRead} 
      WHERE id = ${id} 
      RETURNING *
    `;

    if (updated.length === 0) {
      return Response.json({ error: "Notification not found" }, { status: 404 });
    }

    return Response.json({ success: true, notification: updated[0] });
  } catch (error) {
    logger.error("admin_notification_item_put_error", "Failed to update notification item", error);
    return Response.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    await sql`DELETE FROM admin_notifications WHERE id = ${id}`;

    return Response.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    logger.error("admin_notification_delete_error", "Failed to delete notification", error);
    return Response.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}

