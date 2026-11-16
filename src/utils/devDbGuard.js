import { neon, Pool } from '@neondatabase/serverless';

/**
 * DATABASE SAFETY GUARD
 * 
 * Strict protection rule:
 * 1. Reads ONLY `DEV_DATABASE_URL`.
 * 2. Refuses to run if DEV_DATABASE_URL is missing.
 * 3. Extracts database hosts and refuses to run if DEV_DATABASE_URL host equals
 *    the production database host (DATABASE_URL).
 * 4. Never prints or logs connection strings or secret values.
 */

function extractHost(urlString) {
  if (!urlString) return null;
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.toLowerCase();
  } catch {
    const match = urlString.match(/@([^/:?]+)/);
    return match ? match[1].toLowerCase() : null;
  }
}

export function getDevDatabaseUrl() {
  const devUrl =
    (typeof process !== 'undefined' && process.env?.DEV_DATABASE_URL) ||
    (typeof globalThis !== 'undefined' && globalThis.DEV_DATABASE_URL) ||
    null;

  if (!devUrl || !devUrl.trim()) {
    throw new Error(
      'SAFETY VIOLATION: DEV_DATABASE_URL is not set. Refusing to run tests or migrations without an explicit development branch database.'
    );
  }

  const devHost = extractHost(devUrl);
  if (!devHost) {
    throw new Error(
      'SAFETY VIOLATION: Could not parse a valid hostname from DEV_DATABASE_URL.'
    );
  }

  // Check against production database host if DATABASE_URL is configured
  const prodUrl =
    (typeof process !== 'undefined' && process.env?.DATABASE_URL) ||
    (typeof globalThis !== 'undefined' && globalThis.DATABASE_URL) ||
    null;

  const prodHost = extractHost(prodUrl);

  if (prodHost && devHost === prodHost) {
    throw new Error(
      'SAFETY VIOLATION: DEV_DATABASE_URL host matches the production database host. Refusing to run tests or migrations against production.'
    );
  }

  return devUrl;
}

export function getDevSql() {
  const url = getDevDatabaseUrl();
  return neon(url);
}

export function getDevPool() {
  const url = getDevDatabaseUrl();
  return new Pool({ connectionString: url });
}

export default getDevSql;
