import sql from "@/app/api/utils/sql";
import { requireUser, sanitizeText } from "@/app/api/utils/security";

const ALLOWED_PET_TYPES = new Set(["dog", "cat", "bird", "other"]);

function normalizeImageUrl(rawUrl) {
  if (rawUrl === null || rawUrl === "") return null;
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

export async function PUT(request, { params }) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const petId = parseInt(params?.id, 10);
    if (!Number.isFinite(petId) || petId <= 0) {
      return Response.json({ error: "Invalid pet ID" }, { status: 400 });
    }

    const userId = authResult.user.id;
    const existing = await sql`
      SELECT id, name, type, breed, age, preferences, image_url
      FROM pets
      WHERE id = ${petId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return Response.json({ error: "Pet profile not found" }, { status: 404 });
    }

    const current = existing[0];
    const body = await request.json();

    const name = body?.name !== undefined ? sanitizeText(body.name, 100) : current.name;
    const type =
      body?.type !== undefined
        ? sanitizeText(body.type, 50).toLowerCase()
        : current.type;
    const breed =
      body?.breed !== undefined ? sanitizeText(body.breed || "", 100) || null : current.breed;
    const age =
      body?.age !== undefined ? sanitizeText(body.age || "", 50) || null : current.age;
    const preferences =
      body?.preferences !== undefined
        ? normalizePreferences(body.preferences)
        : current.preferences || {};
    const imageUrl =
      body?.image_url !== undefined ? normalizeImageUrl(body.image_url) : current.image_url;

    if (!name) {
      return Response.json({ error: "Pet name cannot be empty" }, { status: 400 });
    }

    if (!ALLOWED_PET_TYPES.has(type)) {
      return Response.json(
        { error: "Pet type must be one of: dog, cat, bird, other" },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE pets
      SET
        name = ${name},
        type = ${type},
        breed = ${breed},
        age = ${age},
        preferences = ${JSON.stringify(preferences)}::jsonb,
        image_url = ${imageUrl},
        updated_at = NOW()
      WHERE id = ${petId} AND user_id = ${userId}
      RETURNING id, user_id, name, type, breed, age, preferences, image_url, created_at, updated_at
    `;

    return Response.json({ pet: updated[0] });
  } catch (error) {
    console.error("Error updating pet profile:", error);
    return Response.json({ error: "Failed to update pet profile" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const petId = parseInt(params?.id, 10);
    if (!Number.isFinite(petId) || petId <= 0) {
      return Response.json({ error: "Invalid pet ID" }, { status: 400 });
    }

    const userId = authResult.user.id;
    const deleted = await sql`
      DELETE FROM pets
      WHERE id = ${petId} AND user_id = ${userId}
      RETURNING id
    `;

    if (!deleted || deleted.length === 0) {
      return Response.json({ error: "Pet profile not found" }, { status: 404 });
    }

    return Response.json({ deleted: true, id: petId });
  } catch (error) {
    console.error("Error deleting pet profile:", error);
    return Response.json({ error: "Failed to delete pet profile" }, { status: 500 });
  }
}

