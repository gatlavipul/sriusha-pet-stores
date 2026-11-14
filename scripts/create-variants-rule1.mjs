import sql from '../src/app/api/utils/sql.js';

async function main() {
  await sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE`;
  console.log('Added needs_review column to product_variants');

  const products = await sql`
    SELECT id, name, slug, price, compare_price, sale_price, stock_quantity, weight, brand
    FROM products
    ORDER BY id ASC
  `;
  console.log(`Found ${products.length} products`);

  const badMrpProducts = [];
  const createdVariants = [];

  for (const prod of products) {
    const pPrice = parseFloat(prod.sale_price || prod.price || 0);
    const pComparePrice = prod.compare_price ? parseFloat(prod.compare_price) : null;

    if (pComparePrice !== null && pComparePrice <= pPrice) {
      badMrpProducts.push({
        id: prod.id,
        name: prod.name,
        price: pPrice,
        compare_price: pComparePrice,
        issue: 'MRP <= Selling Price',
      });
    }

    // Check if variants already exist for this product
    const existingVars = await sql`SELECT id FROM product_variants WHERE product_id = ${prod.id}`;
    if (existingVars.length > 0) {
      console.log(`Product ${prod.id} already has ${existingVars.length} variants, skipping insert.`);
      continue;
    }

    // Parse weight strings
    let labels = [];
    if (prod.weight) {
      try {
        const parsed = JSON.parse(prod.weight);
        if (Array.isArray(parsed)) {
          labels = parsed.map(v => (typeof v === 'object' ? v.title : v)).filter(Boolean);
        }
      } catch {
        labels = prod.weight.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // If no weight string, create a default "Standard Pack" variant or leave single
    if (labels.length === 0) {
      labels = ['Standard Pack'];
    }

    let sortOrder = 0;
    for (const label of labels) {
      sortOrder++;
      const sku = `SKU-P${prod.id}-${label.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      // Rule 1: keeping the product's current price and stock for now. Do NOT invent new prices, MRPs or stock numbers.
      // needs_review = true on every created variant
      const [inserted] = await sql`
        INSERT INTO product_variants (
          product_id,
          label,
          price,
          compare_price,
          stock_quantity,
          sku,
          is_active,
          sort_order,
          needs_review,
          created_at,
          updated_at
        ) VALUES (
          ${prod.id},
          ${label},
          ${pPrice},
          ${pComparePrice},
          ${prod.stock_quantity ?? 15},
          ${sku},
          true,
          ${sortOrder},
          true,
          NOW(),
          NOW()
        )
        RETURNING *
      `;
      createdVariants.push(inserted);
    }
  }

  console.log('Bad MRP Products:', JSON.stringify(badMrpProducts, null, 2));
  console.log(`Created ${createdVariants.length} variants with needs_review = true:`);
  console.log(JSON.stringify(createdVariants.map(v => ({
    id: v.id,
    product_id: v.product_id,
    label: v.label,
    price: v.price,
    compare_price: v.compare_price,
    stock: v.stock_quantity,
    sku: v.sku,
    needs_review: v.needs_review
  })), null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
