import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    if (body.set_default) {
      await sql`UPDATE user_addresses SET is_default = false WHERE user_id = ${session.user.id}`;
      await sql`UPDATE user_addresses SET is_default = true WHERE id = ${id} AND user_id = ${session.user.id}`;
      return Response.json({ success: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating address:", error);
    return Response.json({ error: "Failed to update address" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    await sql`DELETE FROM user_addresses WHERE id = ${id} AND user_id = ${session.user.id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting address:", error);
    return Response.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
