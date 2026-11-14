import sql from '../src/app/api/utils/sql.js';

async function main() {
  const existing = await sql`SELECT * FROM settings WHERE key = 'store_phone'`;
  console.log('Existing store_phone setting:', existing);
  if (existing.length === 0) {
    await sql`INSERT INTO settings (key, value, updated_at) VALUES ('store_phone', '+91 94402 74418', NOW())`;
    console.log('Inserted store_phone: +91 94402 74418');
  } else {
    await sql`UPDATE settings SET value = '+91 94402 74418', updated_at = NOW() WHERE key = 'store_phone'`;
    console.log('Updated store_phone: +91 94402 74418');
  }
  const check = await sql`SELECT * FROM settings WHERE key = 'store_phone'`;
  console.log('Current store_phone in DB:', check[0]);
}

main().catch(console.error).finally(() => process.exit(0));

