import sql from "@/app/api/utils/sql";
import { requireUser, sanitizeText } from "@/app/api/utils/security";

const ALLOWED_PET_TYPES = new Set(["dog", "cat", "bird", "other"]);

function normalizeImageUrl(rawUrl) {
  const cleaned = sanitizeText(rawUrl, 500);
  if (!cleaned) return null;
  if (
    cleaned.startsWith("/uploads/") ||
    cleaned.startsWith("https://") ||
    cleaned.startsWith("http://")
  ) {
    return cleaned;
  }
  return null;
}

function normalizePreferences(raw) {
  if (!raw || typeof raw !== "object") return {};
  const foodPreference = sanitizeText(raw.food_preference || "", 120);
  const careInterests = Array.isArray(raw.care_interests)
    ? raw.care_interests.map((item) => sanitizeText(item, 60)).filter(Boolean).slice(0, 8)
    : [];
  const notes = sanitizeText(raw.notes || "", 300);

  return {
    ...(foodPreference ? { food_preference: foodPreference } : {}),
    ...(careInterests.length > 0 ? { care_interests: careInterests } : {}),
    ...(notes ? { notes } : {}),
  };
}

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.user.id;

    const [pets, userRows] = await Promise.all([
      sql`
        SELECT id, user_id, name, type, breed, age, preferences, image_url, created_at, updated_at
        FROM pets
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `,
      sql`
        SELECT pet_onboarding_completed
        FROM auth_users
        WHERE id = ${userId}
        LIMIT 1
      `,
    ]);

    return Response.json({
      pets: pets || [],
      onboarding_completed: Boolean(userRows?.[0]?.pet_onboarding_completed),
    });
  } catch (error) {
    console.error("Error fetching pets:", error);
    return Response.json({ error: "Failed to fetch pet profiles" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.user.id;
    const body = await request.json();

    if (body?.onboarding_action === "skip") {
      await sql`
        UPDATE auth_users
        SET pet_onboarding_completed = TRUE
        WHERE id = ${userId}
      `;
      return Response.json({ ok: true, onboarding_completed: true });
    }

    const name = sanitizeText(body?.name, 100);
    const type = sanitizeText(body?.type, 50).toLowerCase();
    const breed = sanitizeText(body?.breed || "", 100) || null;
    const age = sanitizeText(body?.age || "", 50) || null;
    const preferences = normalizePreferences(body?.preferences);
    const imageUrl = normalizeImageUrl(body?.image_url);

    if (!name) {
      return Response.json({ error: "Pet name is required" }, { status: 400 });
    }

    if (!ALLOWED_PET_TYPES.has(type)) {
      return Response.json(
        { error: "Pet type must be one of: dog, cat, bird, other" },
        { status: 400 }
      );
    }

    const inserted = await sql`
      INSERT INTO pets (user_id, name, type, breed, age, preferences, image_url)
      VALUES (${userId}, ${name}, ${type}, ${breed}, ${age}, ${JSON.stringify(preferences)}::jsonb, ${imageUrl})
      RETURNING id, user_id, name, type, breed, age, preferences, image_url, created_at, updated_at
    `;

    await sql`
      UPDATE auth_users
      SET pet_onboarding_completed = TRUE
      WHERE id = ${userId}
    `;

    return Response.json(
      { pet: inserted[0], onboarding_completed: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating pet profile:", error);
    return Response.json({ error: "Failed to save pet profile" }, { status: 500 });
  }
}

