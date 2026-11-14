import { neon, Pool, Client } from '@neondatabase/serverless';
import executeSql from '../src/app/api/utils/sql.js';

async function testHttpBatchTransaction() {
  console.log('--- Testing HTTP neon.transaction ---');
  try {
    const sql = neon(process.env.DATABASE_URL);
    // Test transaction with neon HTTP array
    const res = await sql.transaction([
      sql`SELECT 1 as num`,
      sql`SELECT 2 as num`
    ]);
    console.log('HTTP transaction array result:', res);

    try {
      const resFn = await sql.transaction(async (tx) => {
        const a = await tx`SELECT 1 as val`;
        const b = await tx`SELECT 2 as val`;
        return { a, b };
      });
      console.log('HTTP transaction function result:', resFn);
    } catch (eFn) {
      console.log('HTTP transaction function not supported:', eFn.message);
    }
  } catch (err) {
    console.error('HTTP transaction error:', err);
  }
}

async function testPoolTransaction() {
  console.log('--- Testing Pool / Client Transaction ---');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q1 = await client.query('SELECT 10 as count');
    console.log('Pool query inside BEGIN:', q1.rows);
    await client.query('COMMIT');
    console.log('Pool transaction COMMIT succeeded!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Pool transaction error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  await testHttpBatchTransaction();
  await testPoolTransaction();
}

main().catch(console.error).finally(() => process.exit(0));
