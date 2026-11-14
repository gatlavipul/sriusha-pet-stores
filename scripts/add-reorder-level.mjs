import sql from '../src/app/api/utils/sql.js';

async function main() {
  await sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 5`;
  console.log('Added reorder_level column to product_variants');
}

main().catch(console.error).finally(() => process.exit(0));

