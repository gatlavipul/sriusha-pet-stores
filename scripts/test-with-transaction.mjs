import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function run() {
  // 1. Successful transaction
  const res = await withTransaction(async (client) => {
    const q = await client.query('SELECT 42 as val');
    return q.rows[0].val;
  });
  console.log('Success test result:', res);

  // 2. Rollback transaction on error
  try {
    await withTransaction(async (client) => {
      await client.query('SELECT 1');
      throw new Error('Intentional failure to test rollback');
    });
  } catch (e) {
    console.log('Caught expected error:', e.message);
  }
  await pool.end();
}

run().catch(console.error).finally(() => process.exit(0));

