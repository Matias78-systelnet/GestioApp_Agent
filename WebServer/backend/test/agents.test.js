import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const deviceId = '22222222-2222-4222-8222-222222222222';
const otherDeviceId = '44444444-4444-4444-8444-444444444444';
const token = 'device-token-with-at-least-thirty-two-characters';
process.env.LDAP_URL = 'ldaps://localhost:636';
process.env.LDAP_BIND_DN = 'CN=test,DC=example,DC=com';
process.env.LDAP_BIND_PASSWORD = 'test-only';
process.env.API_TOKEN = 'test-token-with-more-than-thirty-two-characters';
process.env.AGENT_DEVICE_TOKENS = JSON.stringify({ [deviceId]: token });
process.env.LDAP_BASE_DN = 'DC=example,DC=com';
process.env.LDAP_USERS_OU = 'OU=Users,DC=example,DC=com';

const [{ createApp }, { AgentDataStore }, { AgentAssetService }, { SessionStore }] = await Promise.all([
  import('../src/app.js'),
  import('../src/services/agentDataStore.js'),
  import('../src/services/agentAssetService.js'),
  import('../src/services/sessionStore.js')
]);
let server;
let baseUrl;
let dataDirectory;
let sessionStore;

before(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'gestioapp-agent-'));
  const agentDataStore = new AgentDataStore(join(dataDirectory, 'agents.json'));
  sessionStore = new SessionStore();
  const app = createApp({
    agentDataStore,
    agentAssetService: new AgentAssetService(agentDataStore),
    sessionStore
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(dataDirectory, { recursive: true, force: true });
});

function agentFetch(path, body, options = {}) {
  return fetch(`${baseUrl}/api/agents/${path}`, {
    ...options,
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function activityPayload(overrides = {}) {
  return {
    schemaVersion: 1,
    deviceId,
    userSid: 'S-1-5-21-111-222-333-1001',
    userName: 'EXAMPLE\\ana',
    receivedAtUtc: '2026-10-06T14:01:02Z',
    activity: {
      schemaVersion: 1,
      batchId: '11111111-1111-4111-8111-111111111111',
      collectorId: '33333333-3333-4333-8333-333333333333',
      sessionId: 1,
      startedAtUtc: '2026-10-06T14:00:00Z',
      endedAtUtc: '2026-10-06T14:01:00Z',
      activeSeconds: 20,
      idleSeconds: 10,
      lockedSeconds: 15,
      disconnectedSeconds: 5,
      unknownSeconds: 10,
      idleThresholdSeconds: 300
    },
    ...overrides
  };
}

test('requires a configured per-device bearer token and rejects another device id', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/agents/heartbeat`, { method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  const response = await agentFetch('heartbeat', { schemaVersion: 1, deviceId: otherDeviceId, sentAtUtc: '2026-10-06T14:01:02Z' });
  assert.equal(response.status, 403);
});

test('accepts and stores inventory and heartbeat payloads', async () => {
  const inventory = {
    schemaVersion: 1,
    inventoryId: '11111111-1111-4111-8111-111111111111',
    deviceId,
    computerName: 'WS-01',
    collectedAtUtc: '2026-10-06T14:00:00Z',
    cpuModels: ['CPU model'],
    ramInstalledBytes: 17179869184,
    serialNumber: null,
    consoleUser: 'EXAMPLE\\ana',
    volumes: [{ name: 'C:', totalBytes: 1000, freeBytes: 500 }],
    errors: []
  };
  const inventoryResponse = await agentFetch('inventory', inventory);
  assert.equal(inventoryResponse.status, 200);
  assert.deepEqual(await inventoryResponse.json(), { accepted: true, inventoryId: inventory.inventoryId });
  const heartbeatResponse = await agentFetch('heartbeat', { schemaVersion: 1, deviceId, sentAtUtc: '2026-10-06T14:01:02Z' });
  assert.equal(heartbeatResponse.status, 200);
  assert.deepEqual(await heartbeatResponse.json(), { accepted: true });
});

test('lists agent inventory as frontend assets with heartbeat status and short hardware sizes', async () => {
  const now = Date.now();
  const inventory = {
    schemaVersion: 1,
    inventoryId: '66666666-6666-4666-8666-666666666666',
    deviceId,
    computerName: 'WS-FINANZAS-01',
    collectedAtUtc: new Date(now).toISOString(),
    cpuModels: ['CPU model'],
    ramInstalledBytes: 16 * 1024 ** 3,
    serialNumber: 'SERIAL-123',
    consoleUser: null,
    volumes: [{ name: 'C:', totalBytes: 512 * 1024 ** 3, freeBytes: 256 * 1024 ** 3 }],
    errors: []
  };
  await agentFetch('inventory', inventory);
  await agentFetch('heartbeat', { schemaVersion: 1, deviceId, sentAtUtc: new Date(now).toISOString() });

  const sessionToken = sessionStore.create({
    id: 'admin-id', name: 'Admin', email: 'admin@example.com', role: 'Administrador', area: 'TI'
  });
  const response = await fetch(`${baseUrl}/api/v1/assets`, {
    headers: { authorization: `Bearer ${sessionToken}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.items[0].id, deviceId);
  assert.equal(body.items[0].name, 'WS-FINANZAS-01');
  assert.equal(body.items[0].serial, 'SERIAL-123');
  assert.match(body.items[0].status, /^Activo · RAM 16 GiB · Disco 512 GiB$/);
});

test('acknowledges activity with the matching batchId and treats identical retries idempotently', async () => {
  const body = activityPayload();
  const first = await agentFetch('activity', body);
  const duplicate = await agentFetch('activity', { ...body, receivedAtUtc: '2026-10-06T14:02:00Z', userName: 'EXAMPLE\\ana.p' });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { batchId: body.activity.batchId });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { batchId: body.activity.batchId });
});

test('rejects conflicting activity batch ids and invalid duration totals', async () => {
  const body = activityPayload();
  assert.equal((await agentFetch('activity', activityPayload({ activity: { ...body.activity, activeSeconds: 21, unknownSeconds: 9 } }))).status, 409);
  const invalid = activityPayload({ activity: { ...body.activity, batchId: '55555555-5555-4555-8555-555555555555', activeSeconds: 21 } });
  assert.equal((await agentFetch('activity', invalid)).status, 422);
});