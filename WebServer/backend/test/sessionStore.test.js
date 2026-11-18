import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionStore } from '../src/services/sessionStore.js';

test('expires and revokes opaque session tokens', () => {
  let now = 1000;
  const store = new SessionStore({ ttlMs: 500, now: () => now });
  const user = { id: 'abc', role: 'Usuario' };
  const token = store.create(user);

  assert.equal(store.get(token), user);
  store.revoke(token);
  assert.equal(store.get(token), null);

  const expiringToken = store.create(user);
  now = 1500;
  assert.equal(store.get(expiringToken), null);
});