import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

const VALID_ROLES = ["admin", "delivery_partner", "customer"];

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = parseInt(params?.id, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return Response.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const userRows = await sql`
      SELECT id, name, email, role, created_at, pet_onboarding_completed, clerk_user_id
      FROM auth_users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!userRows || userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const [orders, pets] = await Promise.all([
      sql`
        SELECT
          o.id,
          COALESCE(o.order_number, 'SU-2026-' || LPAD(o.id::text, 4, '0')) as order_number,
          o.total_amount,
          o.status,
          o.payment_method,
          o.payment_status,
          o.created_at,
          COUNT(oi.id)::int as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = ${userId}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 25
      `,
      sql`
        SELECT id, name, type, breed, age, preferences, image_url, created_at
        FROM pets
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `,
    ]);

    return Response.json({
      user: userRows[0],
      orders: orders || [],
      pets: pets || [],
    });
  } catch (error) {
    console.error("Error fetching admin user details:", error);
    return Response.json(
      { error: "Failed to load user details" },
      { status: 500 }
    );
  }
}

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
