import sql from '../src/app/api/utils/sql.js';

async function main() {
  console.log("Connecting to Neon database...");
  
  // 1. Inverted prices (sale_price > price)
  const inverted = await sql`
    SELECT id, name, price, sale_price 
    FROM products 
    WHERE sale_price > price AND sale_price IS NOT NULL
  `;
  console.log(`Found ${inverted.length} products with inverted prices.`);
  for (const item of inverted) {
    console.log(`- [ID ${item.id}] ${item.name}: price=${item.price}, sale_price=${item.sale_price}`);
  }

  // 2. Weights with JSON strings
  const jsonWeights = await sql`
    SELECT id, name, weight 
    FROM products 
    WHERE weight LIKE '{%' OR weight LIKE '%"unit"%'
  `;
  console.log(`Found ${jsonWeights.length} products with JSON weights.`);
  for (const item of jsonWeights) {
    console.log(`- [ID ${item.id}] ${item.name}: weight=${item.weight}`);
  }

  // 3. Punctuation typos in titles
  const typoTitles = await sql`
    SELECT id, name 
    FROM products 
    WHERE name LIKE '%.?%' OR name LIKE '% .%' OR name LIKE '%??%'
  `;
  console.log(`Found ${typoTitles.length} products with title typos.`);
  for (const item of typoTitles) {
    console.log(`- [ID ${item.id}] ${item.name}`);
  }

  // 4. Products with screenshot images
  const screenshotImages = await sql`
    SELECT id, name, images 
    FROM products 
    WHERE images::text LIKE '%Screenshot%'
  `;
  console.log(`Found ${screenshotImages.length} products with screenshot images.`);
  for (const item of screenshotImages) {
    console.log(`- [ID ${item.id}] ${item.name}: ${JSON.stringify(item.images)}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
