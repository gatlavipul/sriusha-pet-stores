import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ authenticated: false, user: null });
    }

    const userId = parseInt(session.user.id, 10);
    const rows = await sql`
      SELECT id, name, email, role, created_at, image, clerk_user_id 
      FROM auth_users 
      WHERE id = ${userId} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return Response.json({ authenticated: false, user: null });
    }

    const user = rows[0];
    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        created_at: user.created_at,
        image: user.image,
        clerkUserId: user.clerk_user_id || null,
      },
    });
  } catch (error) {
    console.error("Error in /api/account/me:", error);
    return Response.json(
      { authenticated: false, user: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
