import sql from "@/app/api/utils/sql";
import { requireUser, sanitizeText } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ authenticated: false, user: null });
    }

    const user = authResult.user;
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
        pet_onboarding_completed: Boolean(user.pet_onboarding_completed),
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

export async function PUT(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const cleanName = sanitizeText(body?.name, 120);
    if (!cleanName || cleanName.length < 2) {
      return Response.json(
        { error: "Please enter a valid display name (at least 2 characters)." },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE auth_users
      SET name = ${cleanName}
      WHERE id = ${authResult.user.id}
      RETURNING id, name, email, role, created_at, image, clerk_user_id, pet_onboarding_completed
    `;

    const user = updated[0];
    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        created_at: user.created_at,
        image: user.image,
        clerkUserId: user.clerk_user_id || null,
        pet_onboarding_completed: Boolean(user.pet_onboarding_completed),
      },
    });
  } catch (error) {
    console.error("Error updating profile in /api/account/me:", error);
    return Response.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
