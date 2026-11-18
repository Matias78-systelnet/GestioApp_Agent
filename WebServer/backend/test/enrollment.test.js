import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { EnrollmentStore } from '../src/services/enrollmentStore.js';
import { createApp } from '../src/app.js';
import { SessionStore } from '../src/services/sessionStore.js';
import { AgentDataStore } from '../src/services/agentDataStore.js';
const db = new PGlite();
// PGlite uses one connection; hold it through COMMIT/ROLLBACK.
let tail = Promise.resolve();
async function connect() {
  const previous = tail; let release;
  tail = new Promise(resolve => { release = resolve; }); await previous;
  return { query: async (...args) => { const r = await db.query(...args); return { ...r, rowCount: r.affectedRows ?? r.rows.length }; }, release };
}
const pool = { connect, query: async (...args) => { const c = await connect(); try { return await c.query(...args); } finally { c.release(); } } };
const store = new EnrollmentStore(pool);
let server, base, admin, user, directory;
before(async () => {
  await db.exec(await readFile(new URL('../migrations/001_enrollment.sql', import.meta.url), 'utf8'));
  directory = await mkdtemp(join(tmpdir(), 'enrollment-tests-'));
  const sessions = new SessionStore();
  admin = sessions.create({ role: 'Administrador', email: 'admin@example.com' });
  user = sessions.create({ role: 'Usuario', email: 'user@example.com' });
  server = createApp({ enrollmentStore: store, enrollmentPublicUrl: 'https://example.com', sessionStore: sessions,
    agentDataStore: new AgentDataStore(join(directory, 'agents.json')) }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); await rm(directory, { recursive: true, force: true }); });
function call(path, body, token, method = 'POST') {
  return fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const request = code => ({ code, deviceId: randomUUID(), requestId: randomUUID(), computerName: 'TEST-PC', recoverySecret: randomBytes(32).toString('hex') });
test('Añadir requires session and permissions; code not exposed in list', async () => {
  assert.equal((await call('/api/v1/assets', { name: 'PC' })).status, 401);
  assert.equal((await call('/api/v1/assets', { name: 'PC' }, user)).status, 403);
  const response = await call('/api/v1/assets', { name: 'Oficina' }, admin); assert.equal(response.status, 201);
  const receipt = await response.json(); assert.match(receipt.enrollmentCode, /^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
  const listed = await (await call('/api/v1/assets', undefined, admin, 'GET')).json();
  assert.ok(listed.items.some(row => row.id === receipt.id && row.enrollmentStatus === 'pending'));
  assert.ok(!JSON.stringify(listed).includes(receipt.enrollmentCode));
});
test('Redeem, retry after response loss, authenticated heartbeat and hash-only storage', async () => {
  const invitation = await store.create('Equipo', 'test'); const payload = request(invitation.enrollmentCode);
  const response = await call('/api/agents/enroll', payload); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.deviceId, payload.deviceId);
  assert.equal(result.inventoryEndpoint, 'https://example.com/api/agents/inventory');
  const retry = await (await call('/api/agents/enroll', payload)).json(); assert.equal(retry.token, result.token);
  const beat = { schemaVersion: 1, deviceId: payload.deviceId, sentAtUtc: new Date().toISOString() };
  assert.equal((await call('/api/agents/heartbeat', beat, result.token)).status, 200);
  assert.equal((await call('/api/agents/heartbeat', { ...beat, deviceId: randomUUID() }, result.token)).status, 403);
  const persisted = JSON.stringify((await pool.query('SELECT * FROM gestio_enrollment_devices')).rows);
  for (const secret of [result.token, payload.recoverySecret, invitation.enrollmentCode]) assert.ok(!persisted.includes(secret));
});
test('Single use and replay requires original recovery secret', async () => {
  const invitation = await store.create('Unico', 'test'); const payload = request(invitation.enrollmentCode);
  const responses = await Promise.all([call('/api/agents/enroll', payload), call('/api/agents/enroll', request(invitation.enrollmentCode))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await call('/api/agents/enroll', { ...payload, recoverySecret: randomBytes(32).toString('hex') })).status, 409);
});
test('Expiration and renewal invalidate old code; cannot renew linked device', async () => {
  const invitation = await store.create('Caducado', 'test');
  await pool.query("UPDATE gestio_enrollment_devices SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [invitation.id]);
  assert.equal((await call('/api/agents/enroll', request(invitation.enrollmentCode))).status, 410);
  const renewed = await (await call(`/api/v1/assets/${invitation.id}/enrollment-code`, {}, admin)).json();
  assert.equal((await call('/api/agents/enroll', request(invitation.enrollmentCode))).status, 403);
  assert.equal((await call('/api/agents/enroll', request(renewed.enrollmentCode))).status, 200);
  assert.equal((await call(`/api/v1/assets/${invitation.id}/enrollment-code`, {}, admin)).status, 409);
});
test('Revocation disables authentication and recovery', async () => {
  const invitation = await store.create('Revocar', 'test'); const payload = request(invitation.enrollmentCode);
  const result = await store.redeem(payload);
  assert.equal((await call(`/api/v1/assets/${invitation.id}`, undefined, admin, 'DELETE')).status, 204);
  assert.equal(await store.authenticate(result.token), null);
  assert.equal((await call('/api/agents/enroll', payload)).status, 403);
});
test('Rollback on duplicate device preserves other invitation; invalid request rejected', async () => {
  const first = await store.create('Primero', 'test'); const second = await store.create('Segundo', 'test');
  const payload = request(first.enrollmentCode); await store.redeem(payload);
  assert.equal((await call('/api/agents/enroll', { ...request(second.enrollmentCode), deviceId: payload.deviceId })).status, 409);
  assert.equal((await call('/api/agents/enroll', request(second.enrollmentCode))).status, 200);
  assert.equal((await call('/api/agents/enroll', { code: '1234' })).status, 422);
});
