import sql from '../src/app/api/utils/sql.js';

async function main() {
  console.log('--- 1. Fixing Inverted Prices in Products Table ---');
  // For products where sale_price > price:
  // sale_price was mistakenly stored as the higher MRP, and price was the lower selling price.
  // We set compare_price = sale_price (the MRP), and sale_price = price (the selling price).
  const invertedProducts = await sql`
    SELECT id, name, price, sale_price, compare_price 
    FROM products 
    WHERE sale_price > price AND sale_price IS NOT NULL
  `;
  console.log(`Found ${invertedProducts.length} products with inverted prices.`);

  for (const p of invertedProducts) {
    const mrp = p.sale_price;
    const sellingPrice = p.price;
    await sql`
      UPDATE products 
      SET compare_price = ${mrp},
          sale_price = ${sellingPrice},
          price = ${sellingPrice},
          updated_at = NOW()
      WHERE id = ${p.id}
    `;
    console.log(`  ✓ Updated [ID ${p.id}] ${p.name}: Selling Price = ₹${sellingPrice}, MRP (compare_price) = ₹${mrp}`);
  }

  console.log('\n--- 2. Fixing Product Weights and Sanitizing Data ---');
  // Product 1: parse JSON weight to clean '2.8kg'
  await sql`
    UPDATE products 
    SET weight = '2.8kg', updated_at = NOW() 
    WHERE id = 1
  `;
  console.log('  ✓ Updated [ID 1] weight from JSON to "2.8kg"');

  // Any literal string "null" weights -> set to NULL
  await sql`
    UPDATE products 
    SET weight = NULL, updated_at = NOW() 
    WHERE weight = 'null' OR weight = 'NULL'
  `;
  console.log('  ✓ Cleaned literal "null" string weights to SQL NULL');

  console.log('\n--- 3. Sanitizing Product Titles and Brand Names ---');
  // Product 8: Remove 'Non Veg Non-Veg Logo' artifact
  await sql`
    UPDATE products 
    SET name = 'Chicken Paste Wet Puppy Food - 85g',
        brand = 'Applod',
        updated_at = NOW()
    WHERE id = 8
  `;
  console.log('  ✓ Cleaned [ID 8] name to "Chicken Paste Wet Puppy Food - 85g" and brand to "Applod"');

  // Product 9: Remove leading space
  await sql`
    UPDATE products 
    SET name = 'Chicken & Lamb Chunks In Gravy Adult Wet Dog Food - 85g',
        brand = 'Applod',
        updated_at = NOW()
    WHERE id = 9
  `;
  console.log('  ✓ Cleaned [ID 9] name and brand');

  // Trim all names and brands
  await sql`
    UPDATE products 
    SET name = TRIM(name),
        brand = TRIM(brand),
        updated_at = NOW()
  `;
  console.log('  ✓ Trimmed all product names and brands');

  console.log('\n--- 4. Synchronizing Product Variants with Correct Prices ---');
  // For each product, update standard pack variants to have matching price and compare_price
  const allProds = await sql`SELECT id, price, compare_price FROM products`;
  for (const p of allProds) {
    if (p.compare_price) {
      // Update variants for this product where label is 'Standard Pack' or single variant
      await sql`
        UPDATE product_variants 
        SET price = ${p.price},
            compare_price = ${p.compare_price},
            needs_review = false,
            updated_at = NOW()
        WHERE product_id = ${p.id} AND (label = 'Standard Pack' OR label = '2.8kg')
      `;
    }
  }
  console.log('  ✓ Synchronized product variant prices with selling prices & MRPs');

  console.log('\n--- 5. Verification ---');
  const verified = await sql`
    SELECT id, name, price, sale_price, compare_price, weight, brand 
    FROM products 
    ORDER BY id ASC
  `;
  for (const v of verified) {
    const discount = v.compare_price && parseFloat(v.compare_price) > parseFloat(v.price)
      ? `${Math.round(((parseFloat(v.compare_price) - parseFloat(v.price)) / parseFloat(v.compare_price)) * 100)}% OFF (Save ₹${parseFloat(v.compare_price) - parseFloat(v.price)})`
      : 'No discount';
    console.log(`[ID ${v.id}] ${v.name} | Brand: ${v.brand} | ₹${v.price} (MRP: ₹${v.compare_price || v.price}) | ${discount} | Weight: ${v.weight || 'N/A'}`);
  }
  console.log('\nAll catalog fixes successfully applied!');
}

main().catch(console.error).finally(() => process.exit(0));
