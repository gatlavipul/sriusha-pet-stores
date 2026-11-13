import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const offers = await sql`
      SELECT
        o.*,
        (SELECT COUNT(*)::int FROM offer_redemptions r WHERE r.offer_id = o.id) as redemption_count,
        (SELECT COALESCE(SUM(discount_amount), 0) FROM offer_redemptions r WHERE r.offer_id = o.id) as total_discount_given
      FROM offers o
      ORDER BY o.created_at DESC
    `;

    return Response.json({ offers: offers || [] });
  } catch (error) {
    console.error("Error fetching admin offers:", error);
    return Response.json({ error: "Failed to fetch offers" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const code = sanitizeText(body.code || "", 60).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const title = sanitizeText(body.title || "", 160);
    const description = sanitizeText(body.description || "", 500);
    const offerType = ["first_time", "festival", "general"].includes(body.offer_type)
      ? body.offer_type
      : "general";
    const discountType = ["percentage", "flat"].includes(body.discount_type)
      ? body.discount_type
      : "percentage";
    const discountValue = parseFloat(body.discount_value || 0);
    const minOrderAmount = Math.max(0, parseFloat(body.min_order_amount || 0) || 0);
    const maxDiscount = body.max_discount ? Math.max(0, parseFloat(body.max_discount)) : null;
    const applicableScope = ["all", "category", "product"].includes(body.applicable_scope)
      ? body.applicable_scope
      : "all";
    const applicableIds = Array.isArray(body.applicable_ids)
      ? body.applicable_ids.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const status = ["active", "paused", "expired"].includes(body.status) ? body.status : "active";
    const startDate = body.start_date ? new Date(body.start_date) : null;
    const endDate = body.end_date ? new Date(body.end_date) : null;
    const usageLimitPerUser =
      offerType === "first_time" ? 1 : Math.max(0, parseInt(body.usage_limit_per_user || 0, 10) || 0);

    if (!code || code.length < 3) {
      return Response.json({ error: "Valid offer code (min 3 characters) is required." }, { status: 400 });
    }
    if (!title) {
      return Response.json({ error: "Offer title is required." }, { status: 400 });
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return Response.json({ error: "Discount value must be greater than 0." }, { status: 400 });
    }

    const inserted = await sql`
      INSERT INTO offers (
        code, title, description, offer_type, discount_type, discount_value,
        min_order_amount, max_discount, applicable_scope, applicable_ids,
        start_date, end_date, status, usage_limit_per_user
      ) VALUES (
        ${code}, ${title}, ${description}, ${offerType}, ${discountType}, ${discountValue},
        ${minOrderAmount}, ${maxDiscount}, ${applicableScope}, ${JSON.stringify(applicableIds)}::jsonb,
        ${startDate}, ${endDate}, ${status}, ${usageLimitPerUser}
      )
      RETURNING *
    `;

    return Response.json({ offer: inserted[0] }, { status: 201 });
  } catch (error) {
    if (String(error?.message || "").includes("unique")) {
      return Response.json({ error: "An offer with this code already exists." }, { status: 409 });
    }
    console.error("Error creating offer:", error);
    return Response.json({ error: "Failed to create offer" }, { status: 500 });
  }
}

