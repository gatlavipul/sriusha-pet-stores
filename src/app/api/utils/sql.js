import { neon, Pool } from '@neondatabase/serverless';

let cachedUrl = null;
let cachedSql = null;
let cachedPool = null;

function getSql() {
  const url =
    (typeof process !== 'undefined' && process.env?.DATABASE_URL) ||
    (typeof globalThis !== 'undefined' && globalThis.DATABASE_URL) ||
    null;

  if (!url) {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps DATABASE_URL has not been set.'
    );
  }

  if (url !== cachedUrl || !cachedSql) {
    cachedUrl = url;
    cachedSql = neon(url);
    cachedPool = new Pool({ connectionString: url });
  }
  return cachedSql;
}

function getPool() {
  getSql();
  return cachedPool;
}

export async function withTransaction(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[Neon SQL] Rollback error:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export const executeSql = async (stringsOrQuery, ...values) => {
  const sqlInstance = getSql();

  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (typeof stringsOrQuery === 'string') {
        return await sqlInstance(stringsOrQuery, values[0] || []);
      }
      return await sqlInstance(stringsOrQuery, ...values);
    } catch (err) {
      const isNetworkError =
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('Connection') ||
        err?.message?.includes('connect') ||
        err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err?.cause?.code === 'ECONNRESET' ||
        err?.cause?.code === 'ETIMEDOUT' ||
        err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err?.code === 'ECONNRESET';

      if (isNetworkError && attempt < maxAttempts) {
        const delay = Math.min(6000, 1000 * Math.pow(1.4, attempt));
        console.warn(`[Neon SQL] Transient network error on attempt ${attempt}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
};

executeSql.transaction = async (queries) => {
  const sqlInstance = getSql();
  if (sqlInstance && sqlInstance.transaction) {
    return await sqlInstance.transaction(queries);
  }
  throw new Error('Transactions not available');
};

executeSql.withTransaction = withTransaction;

export default executeSql;
