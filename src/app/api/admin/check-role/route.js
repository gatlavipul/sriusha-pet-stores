import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ isAdmin: false, role: "guest" });
    }

    const users = await sql`
      SELECT id, role, email 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (!users || users.length === 0) {
      return Response.json({ isAdmin: false, role: "guest" });
    }

    const isAdmin = users[0].role === "admin";
    return Response.json({
      isAdmin,
      role: users[0].role || "customer",
      email: users[0].email,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return Response.json(
      { isAdmin: false, role: "guest", error: "Failed to check role" },
      { status: 200 }
    );
  }
}
