import sql from "../app/api/utils/sql.js";

/**
 * Validates an offer code server-side against dates, status, eligibility, and cart scope.
 */
export async function validateAndCalculateOffer({
  code,
  userId = null,
  customerEmail = null,
  cartItems = [], // [{ product_id, category_id, unit_price, quantity }]
  subtotal = 0,
}) {
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: "Please enter an offer code.", discountAmount: 0 };
  }

  const rows = await sql`
    SELECT *
    FROM offers
    WHERE UPPER(code) = ${cleanCode}
    LIMIT 1
  `;

  if (!rows || rows.length === 0) {
    return { valid: false, error: `Offer code "${cleanCode}" is invalid.`, discountAmount: 0 };
  }

  const offer = rows[0];
  const now = new Date();

  if (offer.status !== "active") {
    return { valid: false, error: `Offer "${cleanCode}" is currently ${offer.status}.`, discountAmount: 0 };
  }

  if (offer.start_date && new Date(offer.start_date) > now) {
    return { valid: false, error: `Offer "${cleanCode}" has not started yet.`, discountAmount: 0 };
  }

  if (offer.end_date && new Date(offer.end_date) < now) {
    return { valid: false, error: `Offer "${cleanCode}" has expired.`, discountAmount: 0 };
  }

  const cleanEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : null;

  // First-time customer check: no prior non-cancelled orders and no prior redemption
  if (offer.offer_type === "first_time") {
    if (!userId && !cleanEmail) {
      return {
        valid: false,
        error: "Sign in or enter your email to verify first-time customer eligibility.",
        discountAmount: 0,
      };
    }

    const priorOrders = await sql`
      SELECT COUNT(*)::int as c
      FROM orders
      WHERE status <> 'cancelled'
        AND (
          (${userId ? Number(userId) : null}::int IS NOT NULL AND user_id = ${userId ? Number(userId) : null})
          OR (${cleanEmail}::text IS NOT NULL AND LOWER(customer_email) = ${cleanEmail})
        )
    `;
    if ((priorOrders?.[0]?.c || 0) > 0) {
      return {
        valid: false,
        error: "This First-Time Customer Offer is valid only on your first order.",
        discountAmount: 0,
      };
    }

    const priorRedemptions = await sql`
      SELECT COUNT(*)::int as c
      FROM offer_redemptions
      WHERE offer_id = ${offer.id}
        AND (
          (${userId ? Number(userId) : null}::int IS NOT NULL AND user_id = ${userId ? Number(userId) : null})
          OR (${cleanEmail}::text IS NOT NULL AND LOWER(customer_email) = ${cleanEmail})
        )
    `;
    if ((priorRedemptions?.[0]?.c || 0) > 0) {
      return {
        valid: false,
        error: "You have already used this first-time customer offer.",
        discountAmount: 0,
      };
    }
  }

  // Per-user usage limit
  if (offer.usage_limit_per_user && offer.usage_limit_per_user > 0 && (userId || cleanEmail)) {
    const used = await sql`
      SELECT COUNT(*)::int as c
      FROM offer_redemptions
      WHERE offer_id = ${offer.id}
        AND (
          (${userId ? Number(userId) : null}::int IS NOT NULL AND user_id = ${userId ? Number(userId) : null})
          OR (${cleanEmail}::text IS NOT NULL AND LOWER(customer_email) = ${cleanEmail})
        )
    `;
    if ((used?.[0]?.c || 0) >= offer.usage_limit_per_user) {
      return {
        valid: false,
        error: "You have reached the usage limit for this offer.",
        discountAmount: 0,
      };
    }
  }

  // Compute eligible subtotal based on applicable_scope
  const scopeIds = Array.isArray(offer.applicable_ids)
    ? offer.applicable_ids.map((v) => Number(v))
    : [];

  let eligibleSubtotal = subtotal;
  if (offer.applicable_scope === "product" && scopeIds.length > 0) {
    eligibleSubtotal = cartItems
      .filter((it) => scopeIds.includes(Number(it.product_id)))
      .reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0);
  } else if (offer.applicable_scope === "category" && scopeIds.length > 0) {
    eligibleSubtotal = cartItems
      .filter((it) => scopeIds.includes(Number(it.category_id)))
      .reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0);
  }

  if (eligibleSubtotal <= 0) {
    return {
      valid: false,
      error: `Offer "${cleanCode}" does not apply to the items in your cart.`,
      discountAmount: 0,
    };
  }

  const minOrder = Number(offer.min_order_amount || 0);
  if (subtotal < minOrder) {
    return {
      valid: false,
      error: `Minimum order of ₹${minOrder} required for "${cleanCode}".`,
      discountAmount: 0,
    };
  }

  let discountAmount = 0;
  if (offer.discount_type === "percentage") {
    discountAmount = Math.round(eligibleSubtotal * (Number(offer.discount_value) / 100));
    if (offer.max_discount && Number(offer.max_discount) > 0) {
      discountAmount = Math.min(discountAmount, Number(offer.max_discount));
    }
  } else {
    discountAmount = Math.min(Number(offer.discount_value), eligibleSubtotal);
  }

  discountAmount = Math.max(0, Math.round(discountAmount));

  return {
    valid: true,
    offer: {
      id: offer.id,
      code: offer.code,
      title: offer.title,
      offer_type: offer.offer_type,
      discount_type: offer.discount_type,
      discount_value: Number(offer.discount_value),
    },
    discountAmount,
  };
}

export async function recordOfferRedemption({
  offerId,
  userId = null,
  customerEmail = null,
  orderId,
  discountAmount,
}) {
  if (!offerId || !orderId) return;
  await sql`
    INSERT INTO offer_redemptions (offer_id, user_id, customer_email, order_id, discount_amount, created_at)
    VALUES (
      ${offerId},
      ${userId ? Number(userId) : null},
      ${customerEmail ? String(customerEmail).toLowerCase() : null},
      ${orderId},
      ${Number(discountAmount || 0)},
      NOW()
    )
  `;
}

