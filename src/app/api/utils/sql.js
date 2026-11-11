import { neon } from '@neondatabase/serverless';

const rawSql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export const executeSql = async (stringsOrQuery, ...values) => {
  if (!rawSql) {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
    );
  }

  const maxAttempts = 7;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (typeof stringsOrQuery === 'string') {
        return await rawSql(stringsOrQuery, values[0] || []);
      }
      return await rawSql(stringsOrQuery, ...values);
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
  if (rawSql && rawSql.transaction) {
    return await rawSql.transaction(queries);
  }
  throw new Error('Transactions not available');
};

export default executeSql;
