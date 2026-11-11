import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

const VALID_ROLES = ["admin", "delivery_partner", "customer"];

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const body = await request.json();
    const { role } = body;

    const cleanRole = String(role || "").toLowerCase().trim();

    if (!cleanRole || !VALID_ROLES.includes(cleanRole)) {
      return Response.json(
        { error: `Valid role is required. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Prevent removing admin role from yourself
    if (
      parseInt(id, 10) === parseInt(authResult.user.id, 10) &&
      cleanRole !== "admin"
    ) {
      return Response.json(
        { error: "Cannot demote your own active administrator account" },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE auth_users 
      SET role = ${cleanRole}
      WHERE id = ${id}
      RETURNING id, name, email, role
    `;

    if (updated.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Audit log: role change without logging any secrets
    await sql`
      INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details)
      VALUES (
        ${authResult.user.id},
        'update_role',
        ${id},
        ${JSON.stringify({ new_role: cleanRole, target_email: updated[0].email })}::jsonb
      )
    `;

    return Response.json({ success: true, user: updated[0] });
  } catch (error) {
    console.error("Error updating user role:", error);
    return Response.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;

    // Prevent deleting yourself
    if (parseInt(id, 10) === parseInt(authResult.user.id, 10)) {
      return Response.json(
        { error: "Cannot delete your own active administrator account" },
        { status: 400 }
      );
    }

    const targetUser = await sql`SELECT email, role FROM auth_users WHERE id = ${id} LIMIT 1`;
    if (targetUser.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    await sql`DELETE FROM auth_users WHERE id = ${id}`;

    // Audit log
    await sql`
      INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details)
      VALUES (
        ${authResult.user.id},
        'delete_user',
        ${id},
        ${JSON.stringify({ email: targetUser[0].email, role: targetUser[0].role })}::jsonb
      )
    `;

    return Response.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return Response.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
