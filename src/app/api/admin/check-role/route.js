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

    const user = users[0];
    let role = user.role || "customer";
    let isDelivery = role === "delivery" || role === "delivery_partner";
    let deliveryStatus = null;

    // Authoritative check against delivery_staff table
    try {
      const staffRows = await sql`
        SELECT id, role, status 
        FROM delivery_staff 
        WHERE LOWER(email) = LOWER(${user.email}) OR user_id = ${user.id} OR clerk_user_id = ${user.clerk_user_id}
        LIMIT 1
      `;
      if (staffRows.length > 0) {
        deliveryStatus = staffRows[0].status;
        if (deliveryStatus === "active") {
          isDelivery = true;
          if (role !== "admin") role = "delivery";
        } else if (deliveryStatus === "disabled") {
          isDelivery = false;
          if (role !== "admin") role = "customer";
        }
      }
    } catch (err) {
      console.warn("delivery_staff check error in check-role:", err);
    }

    return Response.json({
      authenticated: true,
      isAdmin: role === "admin",
      isDeliveryPartner: isDelivery,
      isDelivery: isDelivery,
      deliveryStatus: deliveryStatus,
      status: deliveryStatus || "active",
      role,
      email: user.email,
      name: user.name,
      clerkUserId: user.clerk_user_id || null,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return Response.json(
      { authenticated: false, isAdmin: false, isDeliveryPartner: false, role: "guest" },
      { status: 200 }
    );
  }
}
