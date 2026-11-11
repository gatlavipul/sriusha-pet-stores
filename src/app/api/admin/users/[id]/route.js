import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = params;
    const body = await request.json();
    const { role } = body;

    if (!role || (role !== "admin" && role !== "customer")) {
      return Response.json({ error: "Valid role ('admin' or 'customer') is required" }, { status: 400 });
    }

    await sql`
      UPDATE auth_users 
      SET role = ${role}
      WHERE id = ${id}
    `;

    return Response.json({ success: true });
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

    await sql`DELETE FROM auth_users WHERE id = ${id}`;

    return Response.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return Response.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
