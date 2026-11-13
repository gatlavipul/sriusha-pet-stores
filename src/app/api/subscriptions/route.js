import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

export async function GET() {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const subs = await sql`
      SELECT
        s.*,
        p.name as product_name,
        p.slug as product_slug,
        p.image_url,
        p.price as base_price,
        pv.label as variant_label,
        pv.price as variant_price,
        pt.name as pet_name
      FROM pet_subscriptions s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN product_variants pv ON pv.id = s.variant_id
      LEFT JOIN pets pt ON pt.id = s.pet_id
      WHERE s.user_id = ${authResult.user.id}
        AND s.status <> 'cancelled'
      ORDER BY s.next_delivery_date ASC, s.created_at DESC
    `;

    return Response.json({ subscriptions: subs || [] });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return Response.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const productId = parseInt(body.product_id, 10);
    const variantId = body.variant_id ? parseInt(body.variant_id, 10) : null;
    const petId = body.pet_id ? parseInt(body.pet_id, 10) : null;
    const quantity = Math.max(1, parseInt(body.quantity || 1, 10) || 1);
    const frequencyDays = [15, 30, 45, 60, 90].includes(parseInt(body.frequency_days, 10))
      ? parseInt(body.frequency_days, 10)
      : 30;

    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: "Valid product_id is required." }, { status: 400 });
    }

    const prod = await sql`SELECT id, name FROM products WHERE id = ${productId} AND is_active = TRUE LIMIT 1`;
    if (!prod || prod.length === 0) {
      return Response.json({ error: "Product not found or inactive." }, { status: 404 });
    }

    let variantName = body.variant_name || null;
    if (variantId) {
      const v = await sql`SELECT label FROM product_variants WHERE id = ${variantId} AND product_id = ${productId} LIMIT 1`;
      if (!v || v.length === 0) {
        return Response.json({ error: "Selected package variant not found." }, { status: 404 });
      }
      variantName = v[0].label;
    }

    const inserted = await sql`
      INSERT INTO pet_subscriptions (
        user_id, pet_id, product_id, variant_id, variant_name, quantity,
        frequency_days, discount_percent, next_delivery_date, status
      ) VALUES (
        ${authResult.user.id}, ${petId}, ${productId}, ${variantId}, ${variantName}, ${quantity},
        ${frequencyDays}, 5, (CURRENT_DATE + ${frequencyDays}::int), 'active'
      )
      RETURNING *
    `;

    return Response.json({ subscription: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return Response.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}

