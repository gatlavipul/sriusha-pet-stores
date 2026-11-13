import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";
import { getLoyaltyConfig } from "@/utils/loyaltyService";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const [config, statsRows, recentTx] = await Promise.all([
      getLoyaltyConfig(),
      sql`
        SELECT
          COUNT(*)::int as active_holders,
          COALESCE(SUM(points), 0)::int as current_outstanding_points,
          COALESCE(SUM(lifetime_points), 0)::int as total_lifetime_points
        FROM loyalty_points
      `,
      sql`
        SELECT lt.*, u.name as user_name, u.email as user_email
        FROM loyalty_transactions lt
        LEFT JOIN auth_users u ON lt.user_id = u.id::text
        ORDER BY lt.created_at DESC
        LIMIT 20
      `,
    ]);

    return Response.json({
      config,
      stats: statsRows?.[0] || {
        active_holders: 0,
        current_outstanding_points: 0,
        total_lifetime_points: 0,
      },
      recentTransactions: recentTx || [],
    });
  } catch (error) {
    console.error("Error fetching admin rewards config:", error);
    return Response.json({ error: "Failed to fetch rewards settings" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const pairs = [
      ["loyalty_enabled", String(body.enabled !== false)],
      ["loyalty_points_per_100", String(Math.max(0, parseInt(body.pointsPer100 ?? 5, 10) || 0))],
      ["loyalty_point_value_inr", String(Math.max(0.1, parseFloat(body.pointValueInr ?? 1) || 1))],
      ["loyalty_min_redeem", String(Math.max(0, parseInt(body.minRedeem ?? 50, 10) || 0))],
      ["loyalty_first_order_bonus", String(Math.max(0, parseInt(body.firstOrderBonus ?? 25, 10) || 0))],
      ["loyalty_campaign_multiplier", String(Math.max(1, parseFloat(body.campaignMultiplier ?? 1) || 1))],
      ["loyalty_campaign_name", sanitizeText(body.campaignName || "Standard Rewards", 120)],
    ];

    for (const [k, v] of pairs) {
      await sql`
        INSERT INTO settings (key, value)
        VALUES (${k}, ${v})
        ON CONFLICT (key) DO UPDATE SET value = ${v}
      `;
    }

    const config = await getLoyaltyConfig();
    return Response.json({ success: true, config });
  } catch (error) {
    console.error("Error updating rewards config:", error);
    return Response.json({ error: "Failed to update rewards settings" }, { status: 500 });
  }
}

