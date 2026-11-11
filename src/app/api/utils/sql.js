import { neon } from '@neondatabase/serverless';

const rawSql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export const executeSql = async (stringsOrQuery, ...values) => {
  if (!rawSql) {
    throw new Error(
      'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
    );
  }

  const maxAttempts = 3;
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
        err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err?.code === 'UND_ERR_CONNECT_TIMEOUT';

      if (isNetworkError && attempt < maxAttempts) {
        console.warn(`[Neon SQL] Transient network error on attempt ${attempt}. Retrying in ${attempt * 600}ms...`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
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
