import pg from 'pg';
import { readFileSync } from 'node:fs';
export function createEnrollmentPool() {
  if (!process.env.ENROLLMENT_DATABASE_URL) return null;
  const url = new URL(process.env.ENROLLMENT_DATABASE_URL);
  if ([...url.searchParams.keys()].some(key => /^ssl/i.test(key))) throw new Error('Use ENROLLMENT_PG_TLS y ENROLLMENT_PG_CA en vez de parámetros SSL en la URL.');
  const tls = process.env.ENROLLMENT_PG_TLS === 'true';
  return new pg.Pool({ connectionString: url.toString(), max: 10, connectionTimeoutMillis: 5000,
    statement_timeout: 10000, ssl: tls ? { rejectUnauthorized: true,
      ...(process.env.ENROLLMENT_PG_CA ? { ca: readFileSync(process.env.ENROLLMENT_PG_CA, 'utf8') } : {}) } : false });
}
