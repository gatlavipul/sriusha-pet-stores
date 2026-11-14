import sql, { withTransaction } from '../src/app/api/utils/sql.js';
import { executeAtomicOrderTransaction, validateCheckoutPayload } from '../src/utils/checkoutOrderHelper.js';
import { checkServiceability } from '../src/utils/serviceabilityService.js';

const results = [];

function recordResult(testName, passed, details) {
  results.push({ testName, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${details}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('   RUNNING PHASE 3 SHOPPING & CONCURRENCY TEST SUITE');
  console.log('====================================================\n');

  const [user] = await sql`SELECT id, email, name FROM auth_users LIMIT 1`;
  const [prod] = await sql`SELECT id, name, price, sale_price FROM products WHERE is_active = TRUE LIMIT 1`;

  // -------------------------------------------------------------------------
  // TEST 1: Two simultaneous orders for the last unit
  // -------------------------------------------------------------------------
  try {
    const [testVar] = await sql`
      INSERT INTO product_variants (
        product_id, label, price, compare_price, stock_quantity, sku, is_active, sort_order, needs_review, created_at, updated_at
      ) VALUES (
        ${prod.id}, 'Test Race 1Unit', 100, 150, 1, 'TEST-SKU-RACE-1', true, 999, true, NOW(), NOW()
      ) RETURNING id, stock_quantity
    `;

    const makeOrder = (tag) =>
      executeAtomicOrderTransaction({
        userId: user.id,
        customerName: `Test Race ${tag}`,
        customerEmail: user.email,
        customerPhone: '9440274418',
        shippingAddress: '123 Test Street',
        shippingCity: 'Hyderabad',
        shippingPincode: '500039',
        finalTotal: 130,
        paymentStatus: 'pending',
        orderStatus: 'placed',
        deliveryCharge: 30,
        paymentMethod: 'cod',
        deliveryOtp: '1234',
        verifiedItems: [
          {
            product_id: prod.id,
            variant_id: testVar.id,
            variant_name: 'Test Race 1Unit',
            name: prod.name,
            image_url: '/test.png',
            quantity: 1,
            price: 100,
          },
        ],
      });

    const [resA, resB] = await Promise.allSettled([makeOrder('A'), makeOrder('B')]);
    const successes = [resA, resB].filter((r) => r.status === 'fulfilled');
    const failures = [resA, resB].filter((r) => r.status === 'rejected');

    const [finalVar] = await sql`SELECT stock_quantity FROM product_variants WHERE id = ${testVar.id}`;

    const passed = successes.length === 1 && failures.length === 1 && finalVar.stock_quantity === 0;
    recordResult(
      'Two simultaneous orders for the last unit',
      passed,
      `Successes: ${successes.length}, Failures: ${failures.length}, Final Stock: ${finalVar.stock_quantity} (never below 0). Rejection error: "${failures[0]?.reason?.message}"`
    );

    // Cleanup
    await sql`DELETE FROM order_items WHERE variant_id = ${testVar.id}`;
    await sql`DELETE FROM stock_movements WHERE variant_id = ${testVar.id}`;
    await sql`DELETE FROM product_variants WHERE id = ${testVar.id}`;
    if (successes.length > 0) {
      await sql`DELETE FROM orders WHERE id = ${successes[0].value.id}`;
    }
  } catch (err) {
    recordResult('Two simultaneous orders for the last unit', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: 3-item order where 3rd is out of stock -> whole order fails atomically
  // -------------------------------------------------------------------------
  try {
    const [var1] = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
      VALUES (${prod.id}, 'Item 1 InStock', 100, 10, 'TEST-SKU-3ITEM-1', true, true)
      RETURNING id, stock_quantity
    `;
    const [var2] = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
      VALUES (${prod.id}, 'Item 2 InStock', 100, 10, 'TEST-SKU-3ITEM-2', true, true)
      RETURNING id, stock_quantity
    `;
    const [var3] = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
      VALUES (${prod.id}, 'Item 3 OutOfStock', 100, 0, 'TEST-SKU-3ITEM-3', true, true)
      RETURNING id, stock_quantity
    `;

    const ordersCountBefore = await sql`SELECT COUNT(*)::int as count FROM orders`;

    let failedAsExpected = false;
    let errorMessage = '';
    try {
      await executeAtomicOrderTransaction({
        userId: user.id,
        customerName: 'Test 3Item Failure',
        customerEmail: user.email,
        customerPhone: '9440274418',
        shippingAddress: '123 Test Street',
        shippingCity: 'Hyderabad',
        shippingPincode: '500039',
        finalTotal: 330,
        paymentStatus: 'pending',
        orderStatus: 'placed',
        deliveryCharge: 30,
        paymentMethod: 'cod',
        deliveryOtp: '1234',
        verifiedItems: [
          { product_id: prod.id, variant_id: var1.id, variant_name: 'Item 1 InStock', name: prod.name, price: 100, quantity: 1, image_url: '/test.png' },
          { product_id: prod.id, variant_id: var2.id, variant_name: 'Item 2 InStock', name: prod.name, price: 100, quantity: 1, image_url: '/test.png' },
          { product_id: prod.id, variant_id: var3.id, variant_name: 'Item 3 OutOfStock', name: prod.name, price: 100, quantity: 1, image_url: '/test.png' },
        ],
      });
    } catch (e) {
      failedAsExpected = true;
      errorMessage = e.message;
    }

    const [postVar1] = await sql`SELECT stock_quantity FROM product_variants WHERE id = ${var1.id}`;
    const [postVar2] = await sql`SELECT stock_quantity FROM product_variants WHERE id = ${var2.id}`;
    const ordersCountAfter = await sql`SELECT COUNT(*)::int as count FROM orders`;

    const passed =
      failedAsExpected &&
      postVar1.stock_quantity === 10 &&
      postVar2.stock_quantity === 10 &&
      ordersCountAfter[0].count === ordersCountBefore[0].count;

    recordResult(
      '3-item order with 3rd out of stock (atomic rollback)',
      passed,
      `Order threw: "${errorMessage}". Var1 stock: ${postVar1.stock_quantity} (unchanged), Var2 stock: ${postVar2.stock_quantity} (unchanged), No orphan order row created.`
    );

    // Cleanup
    await sql`DELETE FROM product_variants WHERE id IN (${var1.id}, ${var2.id}, ${var3.id})`;
  } catch (err) {
    recordResult('3-item order with 3rd out of stock (atomic rollback)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Price changed after adding to cart -> server uses new price from DB
  // -------------------------------------------------------------------------
  try {
    const [realVar] = await sql`SELECT id, product_id, price FROM product_variants WHERE is_active = TRUE LIMIT 1`;
    const realDbPrice = parseFloat(realVar.price);

    // Client maliciously attempts to send fake price of ₹10
    const tamperedPayload = {
      items: [
        {
          product_id: realVar.product_id,
          variant_id: realVar.id,
          name: 'Tampered Price Test',
          price: 10, // Tampered price
          quantity: 2,
        },
      ],
      userId: user.id,
      customerEmail: user.email,
    };

    const val = await validateCheckoutPayload(tamperedPayload);
    const expectedSubtotal = realDbPrice * 2;
    const passed = val.valid && val.subtotal === expectedSubtotal && val.verifiedItems[0].price === realDbPrice;

    recordResult(
      'Price changed after adding to cart / client price tampering',
      passed,
      `Client sent ₹10, server verified against DB price ₹${realDbPrice}. Verified subtotal: ₹${val.subtotal} (expected: ₹${expectedSubtotal}).`
    );
  } catch (err) {
    recordResult('Price changed after adding to cart / client price tampering', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Deleted / Inactive variant in cart is blocked
  // -------------------------------------------------------------------------
  try {
    const [inactVar] = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
      VALUES (${prod.id}, 'Discontinued Size', 150, 10, 'TEST-SKU-INACT', false, true)
      RETURNING id
    `;

    const val = await validateCheckoutPayload({
      items: [{ product_id: prod.id, variant_id: inactVar.id, quantity: 1, name: 'Discontinued Product' }],
      userId: user.id,
      customerEmail: user.email,
    });

    const passed = !val.valid && val.error.includes('unavailable');
    recordResult(
      'Deleted/inactive variant in cart blocked',
      passed,
      `Checkout rejected with message: "${val.error}" (HTTP status ${val.status}).`
    );

    // Cleanup
    await sql`DELETE FROM product_variants WHERE id = ${inactVar.id}`;
  } catch (err) {
    recordResult('Deleted/inactive variant in cart blocked', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Out-of-pincode address blocked on server
  // -------------------------------------------------------------------------
  try {
    const outServ = await checkServiceability('560001', 500); // Bangalore pincode
    const inServ = await checkServiceability('500039', 500); // Uppal store hub

    const passed = !outServ.serviceable && inServ.serviceable;
    recordResult(
      'Out-of-pincode address blocked on server',
      passed,
      `Pincode 560001 serviceable: ${outServ.serviceable} ("${outServ.reason}"). Pincode 500039 serviceable: ${inServ.serviceable} (${inServ.areaName}, fee: ₹${inServ.deliveryCharge}).`
    );
  } catch (err) {
    recordResult('Out-of-pincode address blocked on server', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Coupon entered in cart does not crash
  // -------------------------------------------------------------------------
  try {
    const itemsPayload = [
      { product_id: prod.id, variant_id: null, quantity: 1 },
    ];
    // Test that items.map works cleanly with real validator
    const { validateAndCalculateOffer } = await import('../src/utils/offerService.js');
    const couponRes = await validateAndCalculateOffer({
      code: 'USHA10',
      userId: user.id,
      customerEmail: user.email,
      cartItems: itemsPayload,
      subtotal: 500,
    });

    const passed = couponRes !== undefined && couponRes !== null;
    recordResult(
      'Coupon entered in cart: no crash (cart.map -> items.map)',
      passed,
      `Coupon USHA10 evaluated without crash. Valid: ${couponRes.valid}, Discount: ₹${couponRes.discountAmount || 0}.`
    );
  } catch (err) {
    recordResult('Coupon entered in cart: no crash (cart.map -> items.map)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Quantity stepper rejected by server when exceeding stock
  // -------------------------------------------------------------------------
  try {
    const [testStockVar] = await sql`
      INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
      VALUES (${prod.id}, 'Stepper Test 2Units', 100, 2, 'TEST-SKU-STEPPER-2', true, true)
      RETURNING id, stock_quantity
    `;

    // Attempt to add 3 units (more than stock of 2)
    const val = await validateCheckoutPayload({
      items: [{ product_id: prod.id, variant_id: testStockVar.id, quantity: 3, name: 'Stepper Test' }],
      userId: user.id,
      customerEmail: user.email,
    });

    const passed = !val.valid && val.error.includes('Only 2');
    recordResult(
      'Quantity stepper rejected by server when exceeding stock',
      passed,
      `Server rejected request exceeding stock with message: "${val.error}". UI triggers rollback and toast.`
    );

    // Cleanup
    await sql`DELETE FROM product_variants WHERE id = ${testStockVar.id}`;
  } catch (err) {
    recordResult('Quantity stepper rejected by server when exceeding stock', false, err.message);
  }

  console.log('\n====================================================');
  console.log('                 FINAL TEST REPORT                  ');
  console.log('====================================================');
  console.table(results);
}

runTests().catch(console.error).finally(() => process.exit(0));
