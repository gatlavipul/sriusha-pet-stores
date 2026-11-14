import sql from "@/app/api/utils/sql";
import { requireUser, sanitizeText, validatePhone } from "@/app/api/utils/security";

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
        phone: user.phone || "",
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
    if (authResult.error || !authResult.user) {
      return Response.json(
        { error: authResult?.error || "Unauthorized. Please sign in." },
        { status: authResult?.status || 401 }
      );
    }

    const body = await request.json();
    const cleanName = sanitizeText(body?.name, 120);
    const rawPhone = body?.phone !== undefined ? sanitizeText(body.phone, 20).replace(/\D/g, "") : null;

    if (body?.name !== undefined && (!cleanName || cleanName.length < 2)) {
      return Response.json(
        { error: "Please enter a valid display name (at least 2 characters)." },
        { status: 400 }
      );
    }

    if (rawPhone !== null && rawPhone.length > 0 && (!validatePhone(rawPhone) || rawPhone.length !== 10)) {
      return Response.json(
        { error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    let updated;
    if (rawPhone !== null && cleanName) {
      updated = await sql`
        UPDATE auth_users
        SET name = ${cleanName}, phone = ${rawPhone}
        WHERE id = ${authResult.user.id}
        RETURNING id, name, email, phone, role, created_at, image, clerk_user_id, pet_onboarding_completed
      `;
    } else if (cleanName) {
      updated = await sql`
        UPDATE auth_users
        SET name = ${cleanName}
        WHERE id = ${authResult.user.id}
        RETURNING id, name, email, phone, role, created_at, image, clerk_user_id, pet_onboarding_completed
      `;
    } else if (rawPhone !== null) {
      updated = await sql`
        UPDATE auth_users
        SET phone = ${rawPhone}
        WHERE id = ${authResult.user.id}
        RETURNING id, name, email, phone, role, created_at, image, clerk_user_id, pet_onboarding_completed
      `;
    } else {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    const user = updated[0];
    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role || "customer",
        created_at: user.created_at,
        image: user.image,
        clerkUserId: user.clerk_user_id || null,
        pet_onboarding_completed: Boolean(user.pet_onboarding_completed),
      },
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Error updating profile in /api/account/me:", error);
    return Response.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
