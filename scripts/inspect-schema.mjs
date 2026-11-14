import sql from '../src/app/api/utils/sql.js';

async function main() {
  const vCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_variants'`;
  console.log('product_variants:', vCols.map(r => `${r.column_name} (${r.data_type})`));

  const zCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'delivery_serviceability_zones'`;
  console.log('delivery_serviceability_zones:', zCols.map(r => `${r.column_name} (${r.data_type})`));

  const sCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'settings'`;
  console.log('settings:', sCols.map(r => `${r.column_name} (${r.data_type})`));

  const smCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_movements'`;
  console.log('stock_movements:', smCols.map(r => `${r.column_name} (${r.data_type})`));

  const zones = await sql`SELECT * FROM delivery_serviceability_zones`;
  console.log('Zones count:', zones.length, zones);

  const settings = await sql`SELECT * FROM settings`;
  console.log('Settings:', settings);
}

main().catch(console.error).finally(() => process.exit(0));
