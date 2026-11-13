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
          SELECT id, product_id, label, price, stock_quantity, is_active
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
    const vid = item.variant_id ? parseInt(item.variant_id, 10) : null;

    if (vid) {
      const dbVar = varMap.get(vid);
      if (!dbVar || dbVar.product_id !== dbProd.id || !dbVar.is_active) {
        return {
          valid: false,
          error: `Selected package size for "${dbProd.name}" is unavailable.`,
          status: 400,
        };
      }
      if (dbVar.stock_quantity < qty) {
        return {
          valid: false,
          error: `Only ${dbVar.stock_quantity} unit(s) of "${dbProd.name} (${dbVar.label})" remaining in stock.`,
          status: 400,
        };
      }
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
          error: `Only ${dbProd.stock_quantity} unit(s) of "${dbProd.name}" remaining in stock.`,
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
 * Atomically deducts stock for products & variants and logs stock_movements.
 */
export async function deductVerifiedOrderStock({
  verifiedItems,
  orderId,
  userId = null,
  userName = "Customer Checkout",
}) {
  for (const item of verifiedItems) {
    if (item.variant_id) {
      const prevRows = await sql`
        SELECT stock_quantity, label FROM product_variants WHERE id = ${item.variant_id} LIMIT 1
      `;
      const prevStock = prevRows?.[0]?.stock_quantity ?? 0;
      const upd = await sql`
        UPDATE product_variants
        SET stock_quantity = GREATEST(0, stock_quantity - ${item.quantity}), updated_at = NOW()
        WHERE id = ${item.variant_id}
        RETURNING stock_quantity, label
      `;
      const newStock = upd?.[0]?.stock_quantity ?? Math.max(0, prevStock - item.quantity);

      // Keep parent product total stock synchronized across active variants
      await sql`
        UPDATE products
        SET stock_quantity = COALESCE((SELECT SUM(stock_quantity)::int FROM product_variants WHERE product_id = ${item.product_id} AND is_active = TRUE), 0),
            updated_at = NOW()
        WHERE id = ${item.product_id}
      `;

      await recordStockMovement({
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.name,
        variantLabel: upd?.[0]?.label || item.variant_name,
        changeAmount: -item.quantity,
        previousStock: prevStock,
        newStock,
        reason: "order_placed",
        notes: `Order #${orderId}`,
        orderId,
        userId,
        userName,
      });
    } else {
      const prevRows = await sql`
        SELECT stock_quantity FROM products WHERE id = ${item.product_id} LIMIT 1
      `;
      const prevStock = prevRows?.[0]?.stock_quantity ?? 0;
      const upd = await sql`
        UPDATE products
        SET stock_quantity = GREATEST(0, stock_quantity - ${item.quantity}), updated_at = NOW()
        WHERE id = ${item.product_id}
        RETURNING stock_quantity
      `;
      const newStock = upd?.[0]?.stock_quantity ?? Math.max(0, prevStock - item.quantity);

      await recordStockMovement({
        productId: item.product_id,
        productName: item.name,
        changeAmount: -item.quantity,
        previousStock: prevStock,
        newStock,
        reason: "order_placed",
        notes: `Order #${orderId}`,
        orderId,
        userId,
        userName,
      });

      await checkAndTriggerLowStock(item.product_id, newStock, item.name);
    }
  }
}

