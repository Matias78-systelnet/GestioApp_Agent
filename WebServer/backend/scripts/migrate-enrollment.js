import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createEnrollmentPool } from '../src/services/enrollmentPool.js';
const pool = createEnrollmentPool();
if (!pool) throw new Error('Falta ENROLLMENT_DATABASE_URL');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(175026, 1)');
  await client.query(await readFile(new URL('../migrations/001_enrollment.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Migración de vinculación aplicada.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
