import sql from "../app/api/utils/sql.js";
import { validateAndCalculateOffer } from "./offerService.js";
import { validateRedemption } from "./loyaltyService.js";
import { recordStockMovement } from "./stockService.js";
import { checkAndTriggerLowStock } from "./notificationService.js";

/**
 * Shared server-side cart, variant stock, prescription, offer & loyalty validator
 */
export async function validateCheckoutPayload({
  items = [],
  promoCode = null,
  userId = null,
  customerEmail = null,
  redeemPoints = 0,
  prescriptionId = null,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: "Your cart is empty.", status: 400 };
  }

  const productIds = items
    .map((it) => parseInt(it.product_id || it.id, 10))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (productIds.length === 0) {
    return { valid: false, error: "Invalid products in cart.", status: 400 };
  }

  const variantIds = items
    .map((it) => (it.variant_id ? parseInt(it.variant_id, 10) : null))
    .filter((n) => Number.isInteger(n) && n > 0);

  const [dbProducts, dbVariants] = await Promise.all([
    sql`
      SELECT id, name, category_id, price, sale_price, stock_quantity, image_url, is_active, requires_prescription
      FROM products
      WHERE id = ANY(${productIds}::int[])
    `,
    variantIds.length > 0
      ? sql`
          SELECT id, product_id, label, price, stock_quantity, is_active, needs_review
          FROM product_variants
          WHERE id = ANY(${variantIds}::int[])
        `
      : Promise.resolve([]),
  ]);

  const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
  const varMap = new Map(dbVariants.map((v) => [v.id, v]));

  let subtotal = 0;
  let requiresPrescription = false;
  const verifiedItems = [];

  for (const item of items) {
    const pid = parseInt(item.product_id || item.id, 10);
    const dbProd = prodMap.get(pid);

    if (!dbProd || !dbProd.is_active) {
      return {
        valid: false,
        error: `Product "${item.name || "Selected item"}" is currently unavailable.`,
        status: 400,
      };
    }

    if (dbProd.requires_prescription) {
      requiresPrescription = true;
    }

    const qty = Math.max(1, parseInt(item.quantity || 1, 10));
    let vid = item.variant_id ? parseInt(item.variant_id, 10) : null;

    // Rule: Unreviewed variants (needs_review = true) must NOT be sold as-is
    // If a product has reviewed variants, use variant stock; otherwise treat as single-option product
    const reviewedActiveVariants = dbVariants.filter(
      (v) => v.product_id === dbProd.id && v.is_active && !v.needs_review
    );

    if (reviewedActiveVariants.length > 0 && !vid) {
      // Find matching by label or default to first reviewed active variant
      const matched =
        reviewedActiveVariants.find((v) => v.label === item.variant_name) ||
        reviewedActiveVariants[0];
      vid = matched.id;
    }

    if (vid) {
      const dbVar = varMap.get(vid);
      if (!dbVar || dbVar.product_id !== dbProd.id || !dbVar.is_active) {
        return {
          valid: false,
          error: `Selected package size for "${dbProd.name}" is unavailable or discontinued.`,
          status: 400,
        };
      }
      if (dbVar.needs_review) {
        return {
          valid: false,
          error: `The selected size for "${dbProd.name}" is pending review and cannot be purchased.`,
          status: 400,
        };
      }
      if (dbVar.stock_quantity < qty) {
        return {
          valid: false,
          error: dbVar.stock_quantity <= 0
            ? `"${dbProd.name} (${dbVar.label})" is currently out of stock.`
            : `Only ${dbVar.stock_quantity} unit(s) of "${dbProd.name} (${dbVar.label})" remaining in stock.`,
          status: 400,
        };
      }
      // Never use client price; use verified database price
      const unitPrice = parseFloat(dbVar.price);
      subtotal += unitPrice * qty;
      verifiedItems.push({
        product_id: dbProd.id,
        category_id: dbProd.category_id,
        variant_id: dbVar.id,
        variant_name: dbVar.label,
        name: dbProd.name,
        price: unitPrice,
        unit_price: unitPrice,
        image_url: dbProd.image_url,
        quantity: qty,
      });
    } else {
      if (dbProd.stock_quantity < qty) {
        return {
          valid: false,
          error: dbProd.stock_quantity <= 0
            ? `"${dbProd.name}" is currently out of stock.`
            : `Only ${dbProd.stock_quantity} unit(s) of "${dbProd.name}" remaining in stock.`,
          status: 400,
        };
      }
      const unitPrice = parseFloat(dbProd.sale_price || dbProd.price);
      subtotal += unitPrice * qty;
      verifiedItems.push({
        product_id: dbProd.id,
        category_id: dbProd.category_id,
        variant_id: null,
        variant_name: item.variant_name || null,
        name: dbProd.name,
        price: unitPrice,
        unit_price: unitPrice,
        image_url: dbProd.image_url,
        quantity: qty,
      });
    }
  }

  // Enforce veterinary prescription upload when cart contains Rx products
  let verifiedPrescription = null;
  if (requiresPrescription) {
    const rxId = prescriptionId ? parseInt(prescriptionId, 10) : null;
    if (!rxId) {
      return {
        valid: false,
        error:
          "This order contains prescription-required medicine. Please upload a valid veterinary prescription before completing checkout.",
        status: 400,
        requiresPrescription: true,
      };
    }

    const rxRows = await sql`
      SELECT id, user_id, status
      FROM prescriptions
      WHERE id = ${rxId}
      LIMIT 1
    `;
    if (!rxRows || rxRows.length === 0) {
      return {
        valid: false,
        error: "Uploaded prescription could not be found.",
        status: 400,
      };
    }
    if (userId && rxRows[0].user_id !== Number(userId)) {
      return {
        valid: false,
        error: "Unauthorized prescription reference.",
        status: 403,
      };
    }
    if (rxRows[0].status === "rejected") {
      return {
        valid: false,
        error: "The selected prescription was rejected. Please upload a valid veterinary prescription.",
        status: 400,
      };
    }
    verifiedPrescription = rxRows[0];
  }

  // Server-side offer validation
  let offerResult = { valid: true, offer: null, discountAmount: 0 };
  if (promoCode && String(promoCode).trim()) {
    offerResult = await validateAndCalculateOffer({
      code: promoCode,
      userId,
      customerEmail,
      cartItems: verifiedItems,
      subtotal,
    });
    if (!offerResult.valid) {
      return { valid: false, error: offerResult.error, status: 400 };
    }
  }

  // Server-side loyalty redemption validation
  const remainingAfterOffer = Math.max(0, subtotal - (offerResult.discountAmount || 0));
  const loyaltyResult = await validateRedemption({
    userId,
    requestedPoints: redeemPoints,
    maxOrderAmount: remainingAfterOffer,
  });
  if (!loyaltyResult.valid) {
    return { valid: false, error: loyaltyResult.error, status: 400 };
  }

  return {
    valid: true,
    subtotal,
    verifiedItems,
    requiresPrescription,
    verifiedPrescription,
    offer: offerResult.offer || null,
    offerDiscount: offerResult.discountAmount || 0,
    pointsToRedeem: loyaltyResult.pointsToRedeem || 0,
    pointsDiscount: loyaltyResult.discountAmount || 0,
  };
}

/**
 * Rule 4: Atomic order placement inside ONE transaction with order creation.
 * Uses UPDATE ... SET stock_quantity = stock_quantity - qty WHERE id = ? AND stock_quantity >= qty.
 * If 0 rows change, rolls back entire transaction and returns "Only N left / Out of stock".
 * Writes a stock_movements row for every deduction.
 */
export async function executeAtomicOrderTransaction({
  userId,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  shippingCity,
  shippingPincode,
  finalTotal,
  paymentStatus,
  orderStatus,
  deliveryCharge,
  paymentMethod,
  offerCode,
  offerDiscount,
  pointsRedeemed,
  pointsDiscount,
  requiresPrescription,
  prescriptionStatus,
  deliveryOtp,
  isGentleDelivery,
  deliveryInstructions,
  verifiedItems,
  offerId = null,
}) {
  return await sql.withTransaction(async (client) => {
    // 1. Atomically deduct stock for every item (Rule 4: no GREATEST(0, ...), strict >= qty check)
    const stockDeductionRecords = [];

    for (const item of verifiedItems) {
      if (item.variant_id) {
        // Atomic variant stock deduction
        const upd = await client.query(
          `UPDATE product_variants
           SET stock_quantity = stock_quantity - $1, updated_at = NOW()
           WHERE id = $2 AND stock_quantity >= $1
           RETURNING stock_quantity, label, product_id`,
          [item.quantity, item.variant_id]
        );

        if (upd.rowCount === 0) {
          const cur = await client.query(
            `SELECT stock_quantity, label FROM product_variants WHERE id = $1`,
            [item.variant_id]
          );
          const rem = cur.rows[0]?.stock_quantity ?? 0;
          const label = cur.rows[0]?.label || item.variant_name || "Selected variant";
          const err = new Error(
            rem <= 0
              ? `"${item.name} (${label})" is out of stock.`
              : `Only ${rem} left of "${item.name} (${label})".`
          );
          err.status = 400;
          throw err;
        }

        const newStock = upd.rows[0].stock_quantity;
        const prevStock = newStock + item.quantity;
        stockDeductionRecords.push({
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.name,
          variantLabel: upd.rows[0].label,
          changeAmount: -item.quantity,
          previousStock: prevStock,
          newStock: newStock,
        });

        // Rule 3: Keep parent product total stock synchronized as sum of reviewed active variants
        await client.query(
          `UPDATE products
           SET stock_quantity = COALESCE((SELECT SUM(stock_quantity)::int FROM product_variants WHERE product_id = $1 AND is_active = TRUE AND needs_review = FALSE), 0),
               updated_at = NOW()
           WHERE id = $1`,
          [item.product_id]
        );
      } else {
        // Atomic base product stock deduction (products without variants)
        const upd = await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $1, updated_at = NOW()
           WHERE id = $2 AND stock_quantity >= $1
           RETURNING stock_quantity`,
          [item.quantity, item.product_id]
        );

        if (upd.rowCount === 0) {
          const cur = await client.query(
            `SELECT stock_quantity FROM products WHERE id = $1`,
            [item.product_id]
          );
          const rem = cur.rows[0]?.stock_quantity ?? 0;
          const err = new Error(
            rem <= 0
              ? `"${item.name}" is out of stock.`
              : `Only ${rem} left of "${item.name}".`
          );
          err.status = 400;
          throw err;
        }

        const newStock = upd.rows[0].stock_quantity;
        const prevStock = newStock + item.quantity;
        stockDeductionRecords.push({
          productId: item.product_id,
          variantId: null,
          productName: item.name,
          variantLabel: item.variant_name || null,
          changeAmount: -item.quantity,
          previousStock: prevStock,
          newStock: newStock,
        });
      }
    }

    // 2. Insert order row into orders
    const orderRes = await client.query(
      `INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_intent_id, payment_status, status,
        delivery_distance, delivery_charge, payment_method,
        offer_code, offer_discount, points_redeemed, points_discount,
        prescription_required, prescription_status,
        delivery_otp, gentle_delivery, delivery_instructions,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10,
        0, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        NOW(), NOW()
      ) RETURNING *`,
      [
        userId,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        shippingCity,
        shippingPincode,
        finalTotal,
        paymentStatus,
        orderStatus,
        deliveryCharge,
        paymentMethod,
        offerCode || null,
        offerDiscount || 0,
        pointsRedeemed || 0,
        pointsDiscount || 0,
        Boolean(requiresPrescription),
        prescriptionStatus || null,
        deliveryOtp,
        isGentleDelivery,
        deliveryInstructions || null,
      ]
    );

    const order = orderRes.rows[0];
    const orderNumber = `SU-${new Date().getFullYear()}-${String(order.id).padStart(4, "0")}`;
    await client.query(`UPDATE orders SET order_number = $1 WHERE id = $2`, [orderNumber, order.id]);
    order.order_number = orderNumber;

    // 3. Insert order_items
    for (const item of verifiedItems) {
      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, variant_id, variant_name, product_name, product_image, quantity, price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          item.product_id,
          item.variant_id || null,
          item.variant_name || null,
          item.name,
          item.image_url,
          item.quantity,
          item.price,
        ]
      );
    }

    // 4. Write a stock_movements row for every deduction
    for (const s of stockDeductionRecords) {
      await client.query(
        `INSERT INTO stock_movements (
          product_id, variant_id, product_name, variant_label,
          change_amount, previous_stock, new_stock, reason,
          notes, order_id, performed_by_user_id, performed_by_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          s.productId,
          s.variantId,
          s.productName,
          s.variantLabel,
          s.changeAmount,
          s.previousStock,
          s.newStock,
          "order_placed",
          `Order #${order.id}`,
          order.id,
          userId,
          customerName,
        ]
      );
    }

    // 5. Offer redemption inside transaction
    if (offerId && offerDiscount > 0) {
      await client.query(
        `INSERT INTO offer_redemptions (
          offer_id, user_id, customer_email, order_id, discount_amount, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [offerId, userId, customerEmail, order.id, offerDiscount]
      );
    }

    // 6. Loyalty points redemption inside transaction
    if (pointsRedeemed > 0) {
      await client.query(
        `INSERT INTO reward_ledger (
          user_id, order_id, points, type, notes, created_at
        ) VALUES ($1, $2, $3, 'redeemed', $4, NOW())`,
        [userId, order.id, -pointsRedeemed, `Redeemed on Order #${order.id}`]
      );
    }

    return order;
  });
}

/**
 * Fallback backward compatibility for other modules
 */
export async function deductVerifiedOrderStock({
  verifiedItems,
  orderId,
  userId = null,
  userName = "Customer Checkout",
}) {
  // Deprecated in favor of executeAtomicOrderTransaction
  return true;
}

