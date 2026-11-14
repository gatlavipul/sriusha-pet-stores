import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText, validatePhone } from "@/app/api/utils/security";

/**
 * PUT /api/admin/delivery-staff/[id]
 * Updates status ('active' / 'disabled'), name, or phone.
 */
export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { status, name, phone } = body;

    const existingStaff = await sql`
      SELECT * FROM delivery_staff WHERE id = ${id} LIMIT 1
    `;

    if (existingStaff.length === 0) {
      return Response.json({ error: "Delivery staff member not found" }, { status: 404 });
    }

    const staff = existingStaff[0];
    const newStatus = status ? String(status).toLowerCase().trim() : staff.status;
    if (status && !["active", "disabled"].includes(newStatus)) {
      return Response.json(
        { error: "Invalid status. Must be 'active' or 'disabled'." },
        { status: 400 }
      );
    }

    const cleanName = name !== undefined ? sanitizeText(name, 100) : staff.name;
    const cleanPhone = phone !== undefined ? (phone ? String(phone).trim().replace(/\D/g, "") : null) : staff.phone;

    if (phone && (!validatePhone(cleanPhone) || cleanPhone.length !== 10)) {
      return Response.json(
        { error: "Phone number must be a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE delivery_staff
      SET status = ${newStatus},
          name = ${cleanName},
          phone = ${cleanPhone},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    const updatedRecord = updated[0];

    // Mirror to user_roles
    try {
      await sql`
        UPDATE user_roles
        SET status = ${newStatus},
            role = ${newStatus === "active" ? "delivery" : "customer"},
            updated_at = NOW()
        WHERE LOWER(email) = LOWER(${staff.email})
      `;
    } catch {}

    // Synchronize role in auth_users immediately
    if (newStatus === "disabled") {
      await sql`
        UPDATE auth_users 
        SET role = 'customer'
        WHERE LOWER(email) = LOWER(${staff.email}) AND role != 'admin'
      `;
    } else if (newStatus === "active") {
      await sql`
        UPDATE auth_users 
        SET role = 'delivery'
        WHERE LOWER(email) = LOWER(${staff.email}) AND role != 'admin'
      `;
    }

    // Audit log
    try {
      await sql`
        INSERT INTO admin_audit_logs (action, admin_email, target_type, target_id, details, created_at)
        VALUES ('UPDATE_DELIVERY_STAFF', ${authResult.user.email}, 'delivery_staff', ${String(id)}, ${JSON.stringify({ status: newStatus, email: staff.email })}, NOW())
      `;
    } catch {}

    return Response.json({ success: true, staff: updatedRecord });
  } catch (error) {
    console.error("Error updating delivery staff:", error);
    return Response.json({ error: error.message || "Failed to update delivery staff" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/delivery-staff/[id]
 * Removes the delivery staff member from delivery_staff and demotes auth_users to customer.
 */
export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const existingStaff = await sql`
      SELECT * FROM delivery_staff WHERE id = ${id} LIMIT 1
    `;

    if (existingStaff.length === 0) {
      return Response.json({ error: "Delivery staff member not found" }, { status: 404 });
    }

    const staff = existingStaff[0];

    // Delete from delivery_staff
    await sql`DELETE FROM delivery_staff WHERE id = ${id}`;

    // Delete or demote in user_roles
    try {
      await sql`DELETE FROM user_roles WHERE LOWER(email) = LOWER(${staff.email})`;
    } catch {}

    // Demote in auth_users if exists
    await sql`
      UPDATE auth_users 
      SET role = 'customer'
      WHERE LOWER(email) = LOWER(${staff.email}) AND role != 'admin'
    `;

    // Audit log
    try {
      await sql`
        INSERT INTO admin_audit_logs (action, admin_email, target_type, target_id, details, created_at)
        VALUES ('REMOVE_DELIVERY_STAFF', ${authResult.user.email}, 'delivery_staff', ${String(id)}, ${JSON.stringify({ email: staff.email, name: staff.name })}, NOW())
      `;
    } catch {}

    return Response.json({ success: true, message: `Removed "${staff.email}" from delivery team.` });
  } catch (error) {
    console.error("Error deleting delivery staff:", error);
    return Response.json({ error: error.message || "Failed to remove delivery staff" }, { status: 500 });
  }
}
