import sql from '../src/app/api/utils/sql.js';

async function main() {
  console.log('--- AUDITING TEST DATA & RECENT CHANGES ---');

  // 1. Check all orders created today
  const recentOrders = await sql`
    SELECT id, order_number, customer_name, customer_email, total_amount, created_at, status
    FROM orders
    ORDER BY created_at DESC
    LIMIT 20
  `;
  console.log('Recent orders count:', recentOrders.length);
  console.log('Recent orders:', recentOrders);

  // 2. Check stock movements created recently
  const recentMovements = await sql`
    SELECT id, product_id, variant_id, product_name, variant_label, change_amount, previous_stock, new_stock, reason, notes, created_at
    FROM stock_movements
    ORDER BY created_at DESC
    LIMIT 20
  `;
  console.log('Recent stock movements:', recentMovements);

  // 3. Check current products stock vs original
  const products = await sql`
    SELECT id, name, price, stock_quantity, updated_at
    FROM products
    ORDER BY id ASC
  `;
  console.log('Current products:', products);

  // 4. Check cart_items
  const cartItems = await sql`
    SELECT id, user_id, product_id, variant_id, quantity, created_at
    FROM cart_items
    ORDER BY created_at DESC
    LIMIT 20
  `;
  console.log('Cart items count:', cartItems.length);
}

main().catch(console.error).finally(() => process.exit(0));

