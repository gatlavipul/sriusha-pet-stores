import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getAuthoritativeSession } from "@/utils/clerkServer";

export async function GET(req) {
  try {
    let session = await auth();

    // If NextAuth session is absent, verify against authoritative Clerk session token
    if (!session?.user?.id && req) {
      const clerkSession = await getAuthoritativeSession(req);
      if (clerkSession?.user) {
        session = clerkSession;
      }
    }

    if (!session?.user?.id) {
      return Response.json({
        authenticated: false,
        isAdmin: false,
        isDeliveryPartner: false,
        role: "guest",
      });
    }

    const userId = parseInt(session.user.id, 10);
    const users = await sql`
      SELECT id, role, email, name, clerk_user_id 
      FROM auth_users 
      WHERE id = ${userId} 
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
      clerkUserId: users[0].clerk_user_id || null,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return Response.json(
      { authenticated: false, isAdmin: false, isDeliveryPartner: false, role: "guest" },
      { status: 200 }
    );
  }
}
