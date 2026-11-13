import fs from "fs";
if (fs.existsSync(".env")) {
  fs.readFileSync(".env", "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
import sql from "./src/app/api/utils/sql.js";
import {
  triggerOrderNotifications,
  NOTIFICATION_TYPES,
} from "./src/utils/notificationService.js";
import {
  getLoyaltyConfig,
  getCustomerLoyaltySummary,
  awardPointsForCompletedOrder,
  validateRedemption,
  commitPointRedemption,
} from "./src/utils/loyaltyService.js";
import {
  validateAndCalculateOffer,
  recordOfferRedemption,
} from "./src/utils/offerService.js";
import {
  recordStockMovement,
  restoreStockForOrder,
} from "./src/utils/stockService.js";
import {
  validateCheckoutPayload,
  deductVerifiedOrderStock,
} from "./src/utils/checkoutOrderHelper.js";
import { validateTransition, ORDER_STATUS } from "./src/utils/orderWorkflow.js";

const BASE_URL = "http://localhost:4000";

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  SRI USHA CLIENT REQUIREMENTS — VERIFICATION SUITE");
  console.log("=======================================================\n");

  const suffix = Date.now();
  let createdProductId = null;
  let createdRxProductId = null;
  let createdOrderId = null;
  let createdRxId = null;
  let createdFirstTimeOfferId = null;
  let createdFestivalOfferId = null;
  let createdTestUserId = null;

  try {
    // Seed a temporary customer user
    const userRes = await sql`
      INSERT INTO auth_users (name, email, role)
      VALUES (${`Test Customer ${suffix}`}, ${`test-cust-${suffix}@example.com`}, 'customer')
      RETURNING id, email
    `;
    createdTestUserId = userRes[0].id;

    // ------------------------------------------------------------------
    // 1. PRODUCT PACKAGE SIZES & STOCK MOVEMENTS
    // ------------------------------------------------------------------
    console.log("--- 1. Product Package Sizes & Stock Ledger ---");
    const prodRes = await sql`
      INSERT INTO products (name, slug, description, price, stock_quantity, is_active, requires_prescription)
      VALUES (${`Test Dog Food ${suffix}`}, ${`test-dog-food-${suffix}`}, 'Test food', 500, 30, true, false)
      RETURNING id, slug
    `;
    createdProductId = prodRes[0].id;
    const prodSlug = prodRes[0].slug;

    const var1Res = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, sort_order)
      VALUES (${createdProductId}, '1 kg', 500, 20, ${`SKU-1KG-${suffix}`}, 0)
      RETURNING id
    `;
    const var3Res = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, sort_order)
      VALUES (${createdProductId}, '3 kg', 1300, 10, ${`SKU-3KG-${suffix}`}, 1)
      RETURNING id
    `;
    const var1Id = var1Res[0].id;
    const var3Id = var3Res[0].id;

    const publicProdRes = await fetch(`${BASE_URL}/api/products/${prodSlug}`);
    const publicProdData = await publicProdRes.json();
    assert(
      publicProdRes.ok && Array.isArray(publicProdData.product?.variants) && publicProdData.product.variants.length === 2,
      "GET /api/products/[slug] returns product_variants array with 2 package sizes"
    );

    const overStockCheck = await validateCheckoutPayload({
      items: [{ product_id: createdProductId, variant_id: var3Id, quantity: 99 }],
      userId: createdTestUserId,
      shippingPincode: "500039",
    });
    assert(
      overStockCheck.error && overStockCheck.status === 400,
      "Checkout validation rejects quantity exceeding selected variant stock"
    );

    // ------------------------------------------------------------------
    // 2. PRESCRIPTION MANAGEMENT
    // ------------------------------------------------------------------
    console.log("\n--- 2. Prescription Management & Private File Protection ---");
    const rxProdRes = await sql`
      INSERT INTO products (name, slug, description, price, stock_quantity, is_active, requires_prescription)
      VALUES (${`Test Vet Med ${suffix}`}, ${`test-vet-med-${suffix}`}, 'Rx medicine', 450, 10, true, true)
      RETURNING id
    `;
    createdRxProductId = rxProdRes[0].id;

    const missingRxCheck = await validateCheckoutPayload({
      items: [{ product_id: createdRxProductId, quantity: 1 }],
      userId: createdTestUserId,
      shippingPincode: "500039",
    });
    assert(
      missingRxCheck.error && missingRxCheck.status === 400,
      "Checkout blocks prescription-required product when no prescription_id is provided"
    );

    const rxInsert = await sql`
      INSERT INTO prescriptions (user_id, product_id, file_path, original_filename, mime_type, status)
      VALUES (${createdTestUserId}, ${createdRxProductId}, ${`nonexistent-${suffix}.pdf`}, 'rx.pdf', 'application/pdf', 'pending')
      RETURNING id
    `;
    createdRxId = rxInsert[0].id;

    const unauthRxFile = await fetch(`${BASE_URL}/api/prescriptions/${createdRxId}/file`);
    assert(
      unauthRxFile.status === 401,
      "Private prescription file endpoint rejects unauthenticated public access (401)"
    );

    const withRxCheck = await validateCheckoutPayload({
      items: [{ product_id: createdRxProductId, quantity: 1 }],
      userId: createdTestUserId,
      shippingPincode: "500039",
      prescriptionId: createdRxId,
    });
    assert(!withRxCheck.error && withRxCheck.requiresPrescription === true, "Checkout accepts valid prescription_id");

    // ------------------------------------------------------------------
    // 3. OFFERS & PROMOTIONS (FIRST-TIME & FESTIVAL)
    // ------------------------------------------------------------------
    console.log("\n--- 3. First-Time & Festival Offers ---");
    const ftOffer = await sql`
      INSERT INTO offers (code, title, offer_type, discount_type, discount_value, min_order_amount, status, usage_limit_per_user)
      VALUES (${`FIRST${suffix}`}, 'First Order 10% Off', 'first_time', 'percentage', 10, 500, 'active', 1)
      RETURNING id, code
    `;
    createdFirstTimeOfferId = ftOffer[0].id;

    const festOffer = await sql`
      INSERT INTO offers (code, title, offer_type, discount_type, discount_value, min_order_amount, status, start_date, end_date)
      VALUES (
        ${`FEST${suffix}`},
        'Festival ₹150 Off',
        'festival',
        'flat',
        150,
        1000,
        'active',
        NOW() - INTERVAL '1 day',
        NOW() + INTERVAL '2 days'
      )
      RETURNING id, code
    `;
    createdFestivalOfferId = festOffer[0].id;

    const ftEval = await validateAndCalculateOffer({
      code: ftOffer[0].code,
      userId: createdTestUserId,
      subtotal: 1300,
      items: [{ product_id: createdProductId, subtotal: 1300 }],
    });
    assert(ftEval.valid && ftEval.discountAmount === 130, "First-time offer applies 10% (₹130) for eligible new customer");

    const festEval = await validateAndCalculateOffer({
      code: festOffer[0].code,
      userId: createdTestUserId,
      subtotal: 1300,
      items: [{ product_id: createdProductId, subtotal: 1300 }],
    });
    assert(festEval.valid && festEval.discountAmount === 150, "Festival offer applies ₹150 within active date window");

    // ------------------------------------------------------------------
    // 4. PAYMENT INTEGRITY, ORDER STOCK DEDUCTION & SINGLE RESTORE
    // ------------------------------------------------------------------
    console.log("\n--- 4. Payment Integrity, Stock Deduction & Single Restore ---");
    const checkoutEval = await validateCheckoutPayload({
      items: [{ product_id: createdProductId, variant_id: var3Id, quantity: 2 }],
      userId: createdTestUserId,
      promoCode: ftOffer[0].code,
    });
    const computedFinalTotal = Math.max(
      0,
      Number(checkoutEval.subtotal || 0) -
        Number(checkoutEval.offerDiscount || 0) -
        Number(checkoutEval.pointsDiscount || 0)
    );
    assert(
      checkoutEval.valid && checkoutEval.subtotal === 2600 && checkoutEval.offerDiscount === 260 && computedFinalTotal === 2340,
      "Server-side checkout computes exact variant subtotal (₹2600), offer discount (₹260), and finalTotal (₹2340)"
    );

    const ordRes = await sql`
      INSERT INTO orders (
        user_id, order_number, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, delivery_charge, payment_method, payment_status, status,
        offer_code, offer_discount
      ) VALUES (
        ${createdTestUserId}, ${`SU-TEST-${suffix}`}, 'Test Customer', ${`test-cust-${suffix}@example.com`}, '9876543210',
        '123 Vet St', 'Hyderabad', '500039',
        ${computedFinalTotal}, 0, 'cod', 'pending', 'placed',
        ${ftOffer[0].code}, ${checkoutEval.offerDiscount}
      )
      RETURNING *
    `;
    createdOrderId = ordRes[0].id;

    for (const item of checkoutEval.verifiedItems) {
      await sql`
        INSERT INTO order_items (
          order_id, product_id, variant_id, variant_name, product_name, product_image, quantity, price
        ) VALUES (
          ${createdOrderId}, ${item.product_id}, ${item.variant_id}, ${item.variant_name},
          ${item.name}, ${item.image_url || null}, ${item.quantity}, ${item.price}
        )
      `;
    }

    await deductVerifiedOrderStock({
      verifiedItems: checkoutEval.verifiedItems,
      orderId: createdOrderId,
      userId: createdTestUserId,
    });
    const afterDeductVar = await sql`SELECT stock_quantity FROM product_variants WHERE id = ${var3Id}`;
    assert(afterDeductVar[0].stock_quantity === 8, "Variant 3kg stock deducted cleanly from 10 to 8");

    await recordOfferRedemption({
      offerId: createdFirstTimeOfferId,
      userId: createdTestUserId,
      orderId: createdOrderId,
      discountAmount: checkoutEval.offerDiscount,
    });

    const ftReuseEval = await validateAndCalculateOffer({
      code: ftOffer[0].code,
      userId: createdTestUserId,
      subtotal: 1300,
      items: [{ product_id: createdProductId, subtotal: 1300 }],
    });
    assert(!ftReuseEval.valid, "First-time offer blocked on second attempt by same customer");

    // Test single-restore on cancellation
    const r1 = await restoreStockForOrder({ orderId: createdOrderId, userId: createdTestUserId });
    const r2 = await restoreStockForOrder({ orderId: createdOrderId, userId: createdTestUserId });
    const afterRestoreVar = await sql`SELECT stock_quantity FROM product_variants WHERE id = ${var3Id}`;
    assert(
      r1.restored === true && r2.restored === false && afterRestoreVar[0].stock_quantity === 10,
      "restoreStockForOrder restores variant stock exactly once and prevents duplicate restore"
    );

    const movLogs = await sql`SELECT * FROM stock_movements WHERE order_id = ${createdOrderId}`;
    assert(movLogs.length >= 2, "stock_movements audit table logged both deduction and restoration");

    // ------------------------------------------------------------------
    // 5. WHATSAPP ORDER LIFECYCLE NOTIFICATIONS
    // ------------------------------------------------------------------
    console.log("\n--- 5. WhatsApp Notifications Queue/Log Across All 5 Events ---");
    const mockOrder = {
      id: createdOrderId,
      order_number: `SU-TEST-${suffix}`,
      user_id: createdTestUserId,
      customer_name: "Test Customer",
      customer_email: `test-cust-${suffix}@example.com`,
      customer_phone: "9876543210",
      total_amount: 2340,
      payment_method: "cod",
    };

    const events = [
      NOTIFICATION_TYPES.ORDER_CONFIRMED,
      NOTIFICATION_TYPES.ORDER_PACKING,
      NOTIFICATION_TYPES.OUT_FOR_DELIVERY,
      NOTIFICATION_TYPES.ORDER_DELIVERED,
      NOTIFICATION_TYPES.DELIVERY_FAILED,
    ];
    for (const ev of events) {
      await triggerOrderNotifications(ev, mockOrder, { reason: "Customer unavailable" });
    }
    const waLogs = await sql`
      SELECT id, channel, status FROM customer_notifications
      WHERE order_id = ${createdOrderId} AND channel = 'whatsapp'
    `;
    assert(waLogs.length >= 5, `WhatsApp notifications logged/queued for all 5 order events (count=${waLogs.length})`);

    // ------------------------------------------------------------------
    // 6. SRI USHA REWARDS & LOYALTY (IDEMPOTENT)
    // ------------------------------------------------------------------
    console.log("\n--- 6. Sri Usha Rewards & Loyalty System ---");
    await sql`
      UPDATE orders SET status = 'delivered', payment_status = 'paid' WHERE id = ${createdOrderId}
    `;
    const award1 = await awardPointsForCompletedOrder(createdOrderId);
    const award2 = await awardPointsForCompletedOrder(createdOrderId);
    assert(
      award1.awarded > 0 && award2.awarded === 0,
      `Loyalty points awarded after delivered+paid (${award1.awarded} pts) and prevented from duplicate awarding (${award2.awarded} pts)`
    );

    const loyaltySum = await getCustomerLoyaltySummary(createdTestUserId);
    assert(
      loyaltySum.balance === award1.awarded && loyaltySum.lifetimePoints === award1.awarded,
      "Customer loyalty summary reflects earned points accurately"
    );

    // ------------------------------------------------------------------
    // 7. CUSTOMER REVIEWS & ADMIN MODERATION
    // ------------------------------------------------------------------
    console.log("\n--- 7. Customer Reviews & Moderation ---");
    const revPost = await fetch(`${BASE_URL}/api/products/${prodSlug}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: 5,
        title: "Great Dog Food",
        comment: "My dog loved this 1kg pack!",
        customer_name: "Test Reviewer",
      }),
    });
    const revPostData = await revPost.json();
    assert(revPost.ok && revPostData.review?.status === "pending", "New review enters 'pending' moderation state");

    const revPublicBefore = await fetch(`${BASE_URL}/api/products/${prodSlug}/reviews`);
    const revPublicBeforeData = await revPublicBefore.json();
    assert(
      revPublicBeforeData.reviews?.length === 0,
      "Pending review is hidden from public storefront until approved"
    );

    await sql`UPDATE product_reviews SET status = 'approved' WHERE id = ${revPostData.review.id}`;
    const revPublicAfter = await fetch(`${BASE_URL}/api/products/${prodSlug}/reviews`);
    const revPublicAfterData = await revPublicAfter.json();
    assert(
      revPublicAfterData.reviews?.length === 1,
      "Approved review is visible on public storefront"
    );

    // Also verify caching header on GET /api/products and active offers endpoint
    const listRes = await fetch(`${BASE_URL}/api/products?limit=5`);
    assert(
      listRes.ok && (listRes.headers.get("cache-control") || "").includes("max-age=30"),
      "GET /api/products includes Cache-Control optimization header"
    );

    const offersRes = await fetch(`${BASE_URL}/api/offers`);
    const offersData = await offersRes.json();
    assert(
      offersRes.ok && Array.isArray(offersData.offers) && offersData.offers.some((o) => o.code === festOffer[0].code),
      "GET /api/offers returns active customer offers"
    );

    assert(
      validateTransition(ORDER_STATUS.PRESCRIPTION_REVIEW, ORDER_STATUS.CONFIRMED, "admin") === null &&
        validateTransition(ORDER_STATUS.PRESCRIPTION_REVIEW, ORDER_STATUS.OUT_FOR_DELIVERY, "admin") !== null,
      "Order workflow permits prescription_review -> confirmed but blocks skipping to out_for_delivery"
    );
  } finally {
    // Clean up temporary test records
    if (createdOrderId) {
      await sql`DELETE FROM loyalty_transactions WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM offer_redemptions WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM customer_notifications WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM stock_movements WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM order_items WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM orders WHERE id = ${createdOrderId}`.catch(() => {});
    }
    if (createdRxId) await sql`DELETE FROM prescriptions WHERE id = ${createdRxId}`.catch(() => {});
    if (createdFirstTimeOfferId) await sql`DELETE FROM offers WHERE id = ${createdFirstTimeOfferId}`.catch(() => {});
    if (createdFestivalOfferId) await sql`DELETE FROM offers WHERE id = ${createdFestivalOfferId}`.catch(() => {});
    if (createdProductId) {
      await sql`DELETE FROM product_reviews WHERE product_id = ${createdProductId}`.catch(() => {});
      await sql`DELETE FROM product_variants WHERE product_id = ${createdProductId}`.catch(() => {});
      await sql`DELETE FROM products WHERE id = ${createdProductId}`.catch(() => {});
    }
    if (createdRxProductId) await sql`DELETE FROM products WHERE id = ${createdRxProductId}`.catch(() => {});
    if (createdTestUserId) {
      await sql`DELETE FROM loyalty_points WHERE user_id = ${String(createdTestUserId)}`.catch(() => {});
      await sql`DELETE FROM auth_users WHERE id = ${createdTestUserId}`.catch(() => {});
    }
  }

  console.log(`\n=======================================================`);
  console.log(`TOTAL PASSED: ${passed}, TOTAL FAILED: ${failed}`);
  console.log(`=======================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});

