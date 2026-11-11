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
    const body = await request.json();
    const { is_active, delivery_charge, free_delivery_threshold, estimated_delivery_time } = body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(Boolean(is_active));
      paramIndex++;
    }

    if (delivery_charge !== undefined) {
      updates.push(`delivery_charge = $${paramIndex}`);
      values.push(Math.max(0, parseFloat(delivery_charge)));
      paramIndex++;
    }

    if (free_delivery_threshold !== undefined) {
      updates.push(`free_delivery_threshold = $${paramIndex}`);
      values.push(Math.max(0, parseFloat(free_delivery_threshold)));
      paramIndex++;
    }

    if (estimated_delivery_time !== undefined) {
      updates.push(`estimated_delivery_time = $${paramIndex}`);
      values.push(String(estimated_delivery_time).slice(0, 100));
      paramIndex++;
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields provided to update" }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE delivery_serviceability_zones SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const updated = await sql(query, values);

    if (updated.length === 0) {
      return Response.json({ error: "Zone not found" }, { status: 404 });
    }

    return Response.json({ success: true, zone: updated[0] });
  } catch (error) {
    logger.error("admin_serviceability_put_error", "Failed to update zone", error);
    return Response.json({ error: "Failed to update zone" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    await sql`DELETE FROM delivery_serviceability_zones WHERE id = ${id}`;

    logger.info("serviceability_zone_deleted", `Zone ${id} deleted by admin ${authResult.user.id}`);
    return Response.json({ success: true, message: "Zone deleted successfully" });
  } catch (error) {
    logger.error("admin_serviceability_delete_error", "Failed to delete zone", error);
    return Response.json({ error: "Failed to delete zone" }, { status: 500 });
  }
}

