import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

const PET_TYPE_CATEGORY_SLUGS = {
  dog: ["dog", "pet-food", "grooming", "healthcare"],
  cat: ["cat", "pet-food", "grooming", "healthcare"],
  bird: ["bird", "pet-food"],
  other: ["pet-food", "grooming", "healthcare"],
};

const CARE_INTEREST_SLUGS = {
  nutrition: "pet-food",
  food: "pet-food",
  grooming: "grooming",
  hygiene: "grooming",
  health: "healthcare",
  healthcare: "healthcare",
  veterinary: "healthcare",
  supplements: "healthcare",
  treats: "pet-food",
};

function getTargetSlugsForPet(pet) {
  const baseSlugs = PET_TYPE_CATEGORY_SLUGS[pet.type] || PET_TYPE_CATEGORY_SLUGS.other;
  const preferredSlugs = [];
  const interests = Array.isArray(pet.preferences?.care_interests)
    ? pet.preferences.care_interests
    : [];

  for (const interest of interests) {
    const key = String(interest || "").toLowerCase();
    for (const [token, slug] of Object.entries(CARE_INTEREST_SLUGS)) {
      if (key.includes(token) && !preferredSlugs.includes(slug)) {
        preferredSlugs.push(slug);
      }
    }
  }

  return Array.from(new Set([...preferredSlugs, ...baseSlugs]));
}

export async function GET() {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.user.id;
    const [pets, categories, products] = await Promise.all([
      sql`
        SELECT id, name, type, breed, age, preferences, image_url
        FROM pets
        WHERE user_id = ${userId}
        ORDER BY created_at ASC
      `,
      sql`
        SELECT id, name, slug, image_url
        FROM categories
        ORDER BY id ASC
      `,
      sql`
        SELECT
          p.id,
          p.name,
          p.slug,
          p.price,
          p.compare_price,
          p.sale_price,
          p.image_url,
          p.stock_quantity,
          p.brand,
          p.weight,
          p.requires_prescription,
          c.id as category_id,
          c.name as category_name,
          c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE
        ORDER BY (p.stock_quantity > 0) DESC, p.created_at DESC
        LIMIT 80
      `,
    ]);

    const recommendations = (pets || []).map((pet) => {
      const targetSlugs = getTargetSlugsForPet(pet);
      const foodPref = String(pet.preferences?.food_preference || "").toLowerCase();

      const scored = (products || [])
        .filter((prod) => targetSlugs.includes(prod.category_slug))
        .map((prod) => {
          let score = 0;
          if (prod.category_slug === pet.type) score += 10;
          const idx = targetSlugs.indexOf(prod.category_slug);
          if (idx >= 0) score += Math.max(1, 6 - idx);
          if (
            foodPref &&
            `${prod.name || ""} ${prod.brand || ""}`.toLowerCase().includes(foodPref)
          ) {
            score += 4;
          }
          if ((prod.stock_quantity || 0) > 0) score += 2;
          return { prod, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((entry) => entry.prod);

      const matchedCategories = (categories || []).filter((c) =>
        targetSlugs.includes(c.slug)
      );

      return {
        pet,
        targetSlugs,
        categories: matchedCategories,
        products: scored,
      };
    });

    return Response.json({
      pets: pets || [],
      categories: categories || [],
      recommendations,
    });
  } catch (error) {
    console.error("Error generating pet recommendations:", error);
    return Response.json(
      { error: "Failed to load recommendations" },
      { status: 500 }
    );
  }
}

