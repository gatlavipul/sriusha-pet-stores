import sql from "../app/api/utils/sql.js";
import logger from "./logger.js";

export async function getLoyaltyConfig() {
  const rows = await sql`
    SELECT key, value
    FROM settings
    WHERE key LIKE 'loyalty_%'
  `;
  const map = {};
  for (const r of rows || []) {
    map[r.key] = r.value;
  }

  return {
    enabled: map.loyalty_enabled !== "false",
    pointsPer100: Math.max(0, parseInt(map.loyalty_points_per_100 || "5", 10) || 5),
    pointValueInr: Math.max(0.1, parseFloat(map.loyalty_point_value_inr || "1") || 1),
    minRedeem: Math.max(0, parseInt(map.loyalty_min_redeem || "50", 10) || 50),
    firstOrderBonus: Math.max(0, parseInt(map.loyalty_first_order_bonus || "25", 10) || 25),
    campaignMultiplier: Math.max(1, parseFloat(map.loyalty_campaign_multiplier || "1") || 1),
    campaignName: map.loyalty_campaign_name || "Standard Rewards",
  };
}

export async function getCustomerLoyaltySummary(userId) {
  const uid = String(userId);
  const [config, pointRows, txRows] = await Promise.all([
    getLoyaltyConfig(),
    sql`
      SELECT points, lifetime_points, updated_at
      FROM loyalty_points
      WHERE user_id = ${uid}
      LIMIT 1
    `,
    sql`
      SELECT id, points, type, description, order_id, created_at
      FROM loyalty_transactions
      WHERE user_id = ${uid}
      ORDER BY created_at DESC
      LIMIT 50
    `,
  ]);

  const balance = pointRows?.[0]?.points ?? 0;
  const lifetime = pointRows?.[0]?.lifetime_points ?? 0;
  const redeemed = (txRows || [])
    .filter((t) => t.type === "redeem")
    .reduce((acc, t) => acc + Math.abs(Number(t.points || 0)), 0);

  return {
    balance,
    lifetimePoints: lifetime,
    redeemedPoints: redeemed,
    transactions: txRows || [],
    config,
  };
}

/**
 * Awards loyalty points idempotently ONLY after an order is validly delivered & paid.
 */
export async function awardPointsForCompletedOrder(orderId) {
  try {
    const config = await getLoyaltyConfig();
    if (!config.enabled) return { awarded: 0, reason: "loyalty_disabled" };

    const orderRows = await sql`
      SELECT id, user_id, total_amount, status, payment_status, order_number
      FROM orders
      WHERE id = ${orderId}
      LIMIT 1
    `;
    if (!orderRows || orderRows.length === 0) {
      return { awarded: 0, reason: "order_not_found" };
    }

    const order = orderRows[0];
    if (!order.user_id) {
      return { awarded: 0, reason: "guest_order" };
    }
    if (order.status !== "delivered" || order.payment_status !== "paid") {
      return { awarded: 0, reason: "order_not_completed" };
    }

    // Prevent duplicate point awards
    const existing = await sql`
      SELECT id FROM loyalty_transactions
      WHERE order_id = ${order.id} AND type = 'earn'
      LIMIT 1
    `;
    if (existing.length > 0) {
      return { awarded: 0, reason: "already_awarded" };
    }

    const uid = String(order.user_id);
    const totalAmount = Math.max(0, parseFloat(order.total_amount || 0));
    const basePoints = Math.floor(totalAmount / 100) * config.pointsPer100;
    const multiplied = Math.round(basePoints * config.campaignMultiplier);

    const priorDelivered = await sql`
      SELECT COUNT(*)::int as c
      FROM orders
      WHERE user_id = ${order.user_id}
        AND status = 'delivered'
        AND id <> ${order.id}
    `;
    const isFirstDelivered = (priorDelivered?.[0]?.c || 0) === 0;
    const bonus = isFirstDelivered ? config.firstOrderBonus : 0;
    const totalAward = multiplied + bonus;

    if (totalAward <= 0) {
      return { awarded: 0, reason: "zero_points" };
    }

    await sql`
      INSERT INTO loyalty_points (user_id, points, lifetime_points, updated_at)
      VALUES (${uid}, ${totalAward}, ${totalAward}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        points = loyalty_points.points + ${totalAward},
        lifetime_points = loyalty_points.lifetime_points + ${totalAward},
        updated_at = NOW()
    `;

    const descParts = [
      `Earned from order ${order.order_number || `#${order.id}`}`,
      config.campaignMultiplier > 1 ? `(${config.campaignName} ${config.campaignMultiplier}x)` : "",
      bonus > 0 ? `+ ${bonus} First-Order Bonus` : "",
    ]
      .filter(Boolean)
      .join(" ");

    await sql`
      INSERT INTO loyalty_transactions (user_id, points, type, description, order_id, created_at)
      VALUES (${uid}, ${totalAward}, 'earn', ${descParts}, ${order.id}, NOW())
    `;

    await sql`
      UPDATE orders SET points_earned = ${totalAward} WHERE id = ${order.id}
    `;

    logger.info("loyalty_points_awarded", `Awarded ${totalAward} points for order #${order.id}`, {
      userId: uid,
      orderId: order.id,
      points: totalAward,
    });

    return { awarded: totalAward };
  } catch (error) {
    logger.error("loyalty_award_error", "Failed to award loyalty points", error, { orderId });
    return { awarded: 0, reason: "error" };
  }
}

export async function validateRedemption({ userId, requestedPoints, maxOrderAmount }) {
  const pts = Math.max(0, parseInt(requestedPoints || 0, 10) || 0);
  if (!userId || pts <= 0) {
    return { valid: true, pointsToRedeem: 0, discountAmount: 0 };
  }

  const config = await getLoyaltyConfig();
  if (!config.enabled) {
    return { valid: false, error: "Loyalty redemption is currently paused." };
  }

  if (pts < config.minRedeem) {
    return {
      valid: false,
      error: `Minimum ${config.minRedeem} points required to redeem.`,
    };
  }

  const uid = String(userId);
  const rows = await sql`SELECT points FROM loyalty_points WHERE user_id = ${uid} LIMIT 1`;
  const balance = rows?.[0]?.points || 0;

  if (balance < pts) {
    return {
      valid: false,
      error: `Insufficient points balance (available: ${balance}).`,
    };
  }

  const rawDiscount = Math.round(pts * config.pointValueInr);
  const discountAmount = Math.min(rawDiscount, Math.max(0, Math.floor(maxOrderAmount)));

  return {
    valid: true,
    pointsToRedeem: pts,
    discountAmount,
  };
}

export async function commitPointRedemption({ userId, orderId, pointsToRedeem, orderNumber }) {
  if (!userId || !pointsToRedeem || pointsToRedeem <= 0) return;
  const uid = String(userId);

  const updated = await sql`
    UPDATE loyalty_points
    SET points = GREATEST(0, points - ${pointsToRedeem}), updated_at = NOW()
    WHERE user_id = ${uid} AND points >= ${pointsToRedeem}
    RETURNING points
  `;

  if (updated.length > 0) {
    await sql`
      INSERT INTO loyalty_transactions (user_id, points, type, description, order_id, created_at)
      VALUES (
        ${uid},
        ${-pointsToRedeem},
        'redeem',
        ${`Redeemed on order ${orderNumber || `#${orderId}`}`},
        ${orderId},
        NOW()
      )
    `;
  }
}

