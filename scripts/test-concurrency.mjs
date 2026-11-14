import sql, { withTransaction } from '../src/app/api/utils/sql.js';

async function placeTestOrder({ variantId, qty, orderTag, userId }) {
  return await withTransaction(async (client) => {
    // 1. Atomic stock deduction
    const upd = await client.query(
      `UPDATE product_variants 
       SET stock_quantity = stock_quantity - $1, updated_at = NOW() 
       WHERE id = $2 AND stock_quantity >= $1 
       RETURNING stock_quantity, label, product_id`,
      [qty, variantId]
    );

    if (upd.rowCount === 0) {
      const cur = await client.query(
        `SELECT stock_quantity, label FROM product_variants WHERE id = $1`,
        [variantId]
      );
      const rem = cur.rows[0]?.stock_quantity ?? 0;
      const err = new Error(rem <= 0 ? "Out of stock" : `Only ${rem} left in stock`);
      err.status = 400;
      throw err;
    }

    const { stock_quantity: newStock, label: variantLabel, product_id: productId } = upd.rows[0];

    // 2. Insert test order
    const orderRes = await client.query(
      `INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_status, status, payment_method,
        delivery_charge, delivery_distance
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING id`,
      [
        userId,
        `Test Runner ${orderTag}`,
        `test_${orderTag}@sriusha.local`,
        '9440274418',
        '123 Test Lane',
        'Hyderabad',
        '500039',
        500,
        'pending',
        'placed',
        'cod',
        30,
        0
      ]
    );
    const orderId = orderRes.rows[0].id;

    // 3. Insert order item
    await client.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, variant_name, product_name, quantity, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, productId, variantId, variantLabel, 'Test Concurrency Product', qty, 500]
    );

    // 4. Log stock movement
    await client.query(
      `INSERT INTO stock_movements (
        product_id, variant_id, product_name, variant_label,
        change_amount, previous_stock, new_stock, reason,
        notes, order_id, performed_by_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        productId,
        variantId,
        'Test Concurrency Product',
        variantLabel,
        -qty,
        newStock + qty,
        newStock,
        'order_placed',
        `Test Order #${orderId} (${orderTag})`,
        orderId,
        `Test Runner ${orderTag}`
      ]
    );

    return { success: true, orderId, newStock };
  });
}

async function main() {
  console.log('--- Setting up test variant with stock = 1 ---');
  const [user] = await sql`SELECT id FROM auth_users LIMIT 1`;
  const [prod] = await sql`SELECT id FROM products LIMIT 1`;
  const [testVar] = await sql`
    INSERT INTO product_variants (
      product_id, label, price, compare_price, stock_quantity, sku, is_active, sort_order, needs_review, created_at, updated_at
    ) VALUES (
      ${prod.id}, 'Concurrency Test 1Unit', 100, 150, 1, 'TEST-SKU-CONC-1', true, 999, true, NOW(), NOW()
    ) RETURNING id, stock_quantity
  `;
  console.log('Created test variant:', testVar.id, 'with stock =', testVar.stock_quantity);

  console.log('--- Firing 2 simultaneous order requests competing for 1 unit ---');
  const [res1, res2] = await Promise.allSettled([
    placeTestOrder({ variantId: testVar.id, qty: 1, orderTag: 'Browser_A', userId: user.id }),
    placeTestOrder({ variantId: testVar.id, qty: 1, orderTag: 'Browser_B', userId: user.id }),
  ]);

  console.log('Result 1:', res1.status, res1.value || res1.reason?.message);
  console.log('Result 2:', res2.status, res2.value || res2.reason?.message);

  const [finalVar] = await sql`SELECT stock_quantity FROM product_variants WHERE id = ${testVar.id}`;
  console.log('Final stock in database:', finalVar.stock_quantity);

  const successes = [res1, res2].filter(r => r.status === 'fulfilled').length;
  const failures = [res1, res2].filter(r => r.status === 'rejected').length;

  console.log(`Summary: Successes = ${successes}, Failures = ${failures}`);
  if (successes === 1 && failures === 1 && finalVar.stock_quantity === 0) {
    console.log('PASSED: Exactly 1 order succeeded, 1 failed, stock is exactly 0 (never negative)!');
  } else {
    console.error('FAILED concurrency test!');
  }

  // Cleanup test variant and test orders
  await sql`DELETE FROM order_items WHERE variant_id = ${testVar.id}`;
  await sql`DELETE FROM stock_movements WHERE variant_id = ${testVar.id}`;
  await sql`DELETE FROM product_variants WHERE id = ${testVar.id}`;
  if (res1.status === 'fulfilled') await sql`DELETE FROM orders WHERE id = ${res1.value.orderId}`;
  if (res2.status === 'fulfilled') await sql`DELETE FROM orders WHERE id = ${res2.value.orderId}`;
  console.log('Cleaned up test data.');
}

main().catch(console.error).finally(() => process.exit(0));
