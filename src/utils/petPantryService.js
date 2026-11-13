import sql from "../app/api/utils/sql.js";

export function parsePackGrams(label = "") {
  const s = String(label || "").toLowerCase();
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g(?:m|ms|rams?)?/);
  if (gMatch) return Math.round(parseFloat(gMatch[1]));
  return 1000;
}

export function estimateDailyGrams(pet) {
  if (pet?.weight_kg && Number(pet.weight_kg) > 0) {
    return Math.max(30, Math.round(Number(pet.weight_kg) * 20));
  }
  const type = String(pet?.type || "").toLowerCase();
  if (type === "dog") return 250;
  if (type === "cat") return 85;
  if (type === "bird") return 30;
  return 120;
}

export async function getCustomerPetPantry(userId) {
  const [pets, orderRows, subs] = await Promise.all([
    sql`SELECT id, name, type, weight_kg FROM pets WHERE user_id = ${userId} ORDER BY id ASC`,
    sql`
      SELECT
        o.id as order_id,
        o.created_at as ordered_at,
        oi.product_id,
        oi.variant_id,
        oi.variant_name,
        oi.product_name,
        oi.quantity,
        oi.price,
        p.slug,
        p.image_url,
        p.weight as product_weight,
        p.stock_quantity as base_stock,
        pv.stock_quantity as variant_stock,
        pv.price as variant_price,
        pv.label as variant_label
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      WHERE o.user_id = ${userId}
        AND o.status NOT IN ('cancelled', 'failed')
        AND p.is_active = TRUE
      ORDER BY o.created_at DESC
      LIMIT 80
    `,
    sql`
      SELECT id, product_id, variant_id, status
      FROM pet_subscriptions
      WHERE user_id = ${userId} AND status IN ('active', 'paused')
    `,
  ]);

  const primaryPet = pets?.[0] || null;
  const dailyGrams = estimateDailyGrams(primaryPet);
  const subMap = new Map((subs || []).map((s) => [`${s.product_id}:${s.variant_id || 0}`, s]));

  // Group by product_id + variant_id to track latest order and learned reorder interval
  const grouped = new Map();
  for (const row of orderRows || []) {
    const key = `${row.product_id}:${row.variant_id || 0}`;
    if (!grouped.has(key)) {
      grouped.set(key, { latest: row, timestamps: [new Date(row.ordered_at).getTime()] });
    } else {
      grouped.get(key).timestamps.push(new Date(row.ordered_at).getTime());
    }
  }

  const now = Date.now();
  const pantryItems = [];

  for (const [key, entry] of grouped.entries()) {
    const row = entry.latest;
    const label = row.variant_label || row.variant_name || row.product_weight || row.product_name;
    const packGrams = parsePackGrams(label) * Math.max(1, Number(row.quantity || 1));

    // Learn from real repeat orders if >= 2 orders exist, otherwise use pack / daily portion
    let estimatedTotalDays = Math.max(7, Math.round(packGrams / dailyGrams));
    if (entry.timestamps.length >= 2) {
      const spanDays = Math.round((entry.timestamps[0] - entry.timestamps[1]) / 86400000);
      if (spanDays >= 3 && spanDays <= 180) {
        estimatedTotalDays = spanDays;
      }
    }

    const daysSinceOrder = Math.max(0, Math.floor((now - new Date(row.ordered_at).getTime()) / 86400000));
    const percentConsumed = Math.min(100, Math.round((daysSinceOrder / estimatedTotalDays) * 100));
    const estimatedDaysRemaining = Math.max(0, estimatedTotalDays - daysSinceOrder);
    const runoutDate = new Date(new Date(row.ordered_at).getTime() + estimatedTotalDays * 86400000);
    const availableStock = row.variant_id ? Number(row.variant_stock ?? 0) : Number(row.base_stock ?? 0);

    pantryItems.push({
      key,
      product_id: row.product_id,
      variant_id: row.variant_id || null,
      variant_name: row.variant_label || row.variant_name || null,
      product_name: row.product_name,
      slug: row.slug,
      image_url: row.image_url,
      price: Number(row.variant_price || row.price || 0),
      available_stock: availableStock,
      pet_name: primaryPet?.name || null,
      last_ordered_at: row.ordered_at,
      estimated_cycle_days: estimatedTotalDays,
      days_since_order: daysSinceOrder,
      estimated_days_remaining: estimatedDaysRemaining,
      estimated_runout_date: runoutDate.toISOString(),
      percent_consumed: percentConsumed,
      running_low: percentConsumed >= 75,
      subscription: subMap.get(key) || null,
    });
  }

  pantryItems.sort((a, b) => b.percent_consumed - a.percent_consumed);
  return {
    pet: primaryPet,
    items: pantryItems,
  };
}

