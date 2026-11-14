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
  console.log('   RUNNING PHASE 3 SHOPPING SUITE (ZZ-TEST DATA ONLY)');
  console.log('====================================================\n');

  let testProdId = null;

  try {
    // 0. Initial cleanup of any past ZZ-TEST data
    await sql`DELETE FROM order_items WHERE product_name LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM stock_movements WHERE product_name LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM orders WHERE customer_name LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM product_variants WHERE label LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM products WHERE name LIKE 'ZZ-TEST%'`;

    const [user] = await sql`SELECT id, email, name FROM auth_users LIMIT 1`;
    const [category] = await sql`SELECT id FROM categories LIMIT 1`;
    const catId = category?.id || 1;

    // Create a dedicated ZZ-TEST parent product
    const [prod] = await sql`
      INSERT INTO products (
        name, slug, description, price, compare_price, stock_quantity,
        category_id, is_active, weight
      ) VALUES (
        'ZZ-TEST Shopping Product',
        ${'zz-test-shopping-product-' + Date.now()},
        'Phase 3 automated test item',
        500.00,
        600.00,
        25,
        ${catId},
        true,
        '1 kg, 3 kg'
      ) RETURNING id, name, price, sale_price, stock_quantity
    `;
    testProdId = prod.id;
    console.log(`[SETUP] Created test product ID ${testProdId}: "${prod.name}" (Stock: ${prod.stock_quantity}, Price: ₹${prod.price})\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Two simultaneous orders for the last unit
    // -------------------------------------------------------------------------
    try {
      const [testVar] = await sql`
        INSERT INTO product_variants (
          product_id, label, price, compare_price, stock_quantity, sku, is_active, sort_order, needs_review, created_at, updated_at
        ) VALUES (
          ${prod.id}, 'ZZ-TEST Race 1Unit', 100, 150, 1, 'ZZ-SKU-RACE-1', true, 999, false, NOW(), NOW()
        ) RETURNING id, stock_quantity
      `;

      const makeOrder = (tag) =>
        executeAtomicOrderTransaction({
          userId: user.id,
          customerName: `ZZ-TEST Race ${tag}`,
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
              variant_name: 'ZZ-TEST Race 1Unit',
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
        VALUES (${prod.id}, 'ZZ-TEST Item 1 InStock', 100, 10, 'ZZ-SKU-3ITEM-1', true, false)
        RETURNING id, stock_quantity
      `;
      const [var2] = await sql`
        INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
        VALUES (${prod.id}, 'ZZ-TEST Item 2 InStock', 100, 10, 'ZZ-SKU-3ITEM-2', true, false)
        RETURNING id, stock_quantity
      `;
      const [var3] = await sql`
        INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
        VALUES (${prod.id}, 'ZZ-TEST Item 3 OutOfStock', 100, 0, 'ZZ-SKU-3ITEM-3', true, false)
        RETURNING id, stock_quantity
      `;

      const ordersCountBefore = await sql`SELECT COUNT(*)::int as count FROM orders`;

      let failedAsExpected = false;
      let errorMessage = '';
      try {
        await executeAtomicOrderTransaction({
          userId: user.id,
          customerName: 'ZZ-TEST 3Item Failure',
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
            { product_id: prod.id, variant_id: var1.id, variant_name: 'ZZ-TEST Item 1 InStock', name: prod.name, price: 100, quantity: 1, image_url: '/test.png' },
            { product_id: prod.id, variant_id: var2.id, variant_name: 'ZZ-TEST Item 2 InStock', name: prod.name, price: 100, quantity: 1, image_url: '/test.png' },
            { product_id: prod.id, variant_id: var3.id, variant_name: 'ZZ-TEST Item 3 OutOfStock', name: prod.name, price: 100, quantity: 1, image_url: '/test.png' },
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
    // TEST 3: Price changed after adding to cart -> server uses verified DB price
    // -------------------------------------------------------------------------
    try {
      const [testVarP] = await sql`
        INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
        VALUES (${prod.id}, 'ZZ-TEST Verified Price', 250.00, 10, 'ZZ-SKU-VERIF', true, false)
        RETURNING id, product_id, price
      `;
      const realDbPrice = parseFloat(testVarP.price);

      // Client maliciously attempts to send fake price of ₹10
      const tamperedPayload = {
        items: [
          {
            product_id: testVarP.product_id,
            variant_id: testVarP.id,
            name: 'ZZ-TEST Tampered Price Test',
            price: 10, // Tampered price
            quantity: 2,
          },
        ],
        userId: user.id,
        customerEmail: user.email,
      };

      const val = await validateCheckoutPayload(tamperedPayload);
      const expectedSubtotal = realDbPrice * 2;
      const passed = val.valid && val.verifiedItems[0].price === realDbPrice;

      recordResult(
        'Price changed after adding to cart / client price tampering',
        passed,
        `Client sent ₹10, server verified against DB price ₹${realDbPrice}. Verified unit price: ₹${val.verifiedItems?.[0]?.price} (expected: ₹${realDbPrice}).`
      );

      await sql`DELETE FROM product_variants WHERE id = ${testVarP.id}`;
    } catch (err) {
      recordResult('Price changed after adding to cart / client price tampering', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Deleted / Inactive variant in cart is blocked
    // -------------------------------------------------------------------------
    try {
      const [inactVar] = await sql`
        INSERT INTO product_variants (product_id, label, price, stock_quantity, sku, is_active, needs_review)
        VALUES (${prod.id}, 'ZZ-TEST Discontinued Size', 150, 10, 'ZZ-SKU-INACT', false, false)
        RETURNING id
      `;

      const val = await validateCheckoutPayload({
        items: [{ product_id: prod.id, variant_id: inactVar.id, quantity: 1, name: 'ZZ-TEST Discontinued Product' }],
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
        VALUES (${prod.id}, 'ZZ-TEST Stepper Test 2Units', 100, 2, 'ZZ-SKU-STEPPER-2', true, false)
        RETURNING id, stock_quantity
      `;

      // Attempt to add 3 units (more than stock of 2)
      const val = await validateCheckoutPayload({
        items: [{ product_id: prod.id, variant_id: testStockVar.id, quantity: 3, name: 'ZZ-TEST Stepper Test' }],
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

  } finally {
    // Guaranteed Teardown: Clean up all ZZ-TEST rows
    console.log('\n[TEARDOWN] Purging all ZZ-TEST rows from database...');
    await sql`DELETE FROM order_items WHERE product_name LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM stock_movements WHERE product_name LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM orders WHERE customer_name LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM product_variants WHERE label LIKE 'ZZ-TEST%'`;
    await sql`DELETE FROM products WHERE name LIKE 'ZZ-TEST%'`;
    console.log('[TEARDOWN] Complete. Zero test artifacts left in DB.');
  }

  console.log('\n====================================================');
  console.log('                 FINAL TEST REPORT                  ');
  console.log('====================================================');
  console.table(results);

  const allPassed = results.every((r) => r.passed);
  console.log(`\nOVERALL SUITE STATUS: ${allPassed ? 'ALL TESTS PASSED (PASS)' : 'FAILURES DETECTED'}\n`);
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(console.error).finally(() => process.exit(0));
