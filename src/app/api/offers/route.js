import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const offers = await sql`
      SELECT
        id, code, title, description, offer_type, discount_type, discount_value,
        min_order_amount, max_discount, applicable_scope, start_date, end_date
      FROM offers
      WHERE status = 'active'
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return Response.json(
      { offers: offers || [] },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching public offers:", error);
    return Response.json({ error: "Failed to load active offers" }, { status: 500 });
  }
}

