import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({
        authenticated: false,
        isAdmin: false,
        isDeliveryPartner: false,
        role: "guest",
      });
    }

    const users = await sql`
      SELECT id, role, email, name 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (!users || users.length === 0) {
      return Response.json({
        authenticated: false,
        isAdmin: false,
        isDeliveryPartner: false,
        role: "guest",
      });
    }

    const role = users[0].role || "customer";
    return Response.json({
      authenticated: true,
      isAdmin: role === "admin",
      isDeliveryPartner: role === "delivery_partner",
      role,
      email: users[0].email,
      name: users[0].name,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return Response.json(
      { authenticated: false, isAdmin: false, isDeliveryPartner: false, role: "guest" },
      { status: 200 }
    );
  }
}
