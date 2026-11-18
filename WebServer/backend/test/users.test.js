import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

// La suite usa configuración de prueba y no necesita conectarse a un Samba AD real.
process.env.LDAP_URL = 'ldaps://localhost:636';
process.env.LDAP_BIND_DN = 'CN=test,DC=example,DC=com';
process.env.LDAP_BIND_PASSWORD = 'test-only';
process.env.API_TOKEN = 'test-token-with-more-than-thirty-two-characters';
process.env.LDAP_BASE_DN = 'DC=example,DC=com';
process.env.LDAP_USERS_OU = 'OU=Users,DC=example,DC=com';

const { createApp } = await import('../src/app.js');
// Objeto representativo que devuelve el servicio simulado.
const user = {
  id: '1234', username: 'ana', givenName: 'Ana', surname: 'Perez',
  displayName: 'Ana Perez', email: 'ana@example.com', department: '', title: '', enabled: true
};
const frontendUser = {
  id: '1234567890abcdef1234567890abcdef', name: 'Ana Pérez', rut: '16.234.567-2',
  email: 'ana.perez@empresa.cl', role: 'Usuario', area: 'RRHH', status: 'active',
  assetCount: 0, lastAccess: null, avgConnectionMin: null
};
const sessionUser = {
  id: frontendUser.id, name: 'Admin Ana', email: 'admin@empresa.cl', role: 'Administrador', area: 'Informática'
};

let server;
let baseUrl;
let calls;

before(async () => {
  // El doble registra argumentos para verificar el contrato de las rutas.
  const userService = {
    async list(options) {
      calls.list = options;
      return { users: [user], hasMore: false };
    },
    async get(username) {
      calls.get = username;
      return username === user.username ? user : null;
    },
    async create(data) {
      calls.create = data;
      return user;
    },
    async update(username, data) {
      calls.update = { username, data };
      return username === user.username ? user : null;
    },
    async remove(username) {
      calls.remove = username;
      return username === user.username;
    },
    async listFrontend() {
      calls.frontList = true;
      return [frontendUser];
    },
    async createFrontend(data) {
      calls.frontCreate = data;
      return frontendUser;
    },
    async getById(id) {
      calls.frontGet = id;
      return id === frontendUser.id ? frontendUser : null;
    },
    async updateFrontend(id, data) {
      calls.frontUpdate = { id, data };
      return id === frontendUser.id ? frontendUser : null;
    },
    async setStatusById(id, status) {
      calls.frontStatus = { id, status };
      return id === frontendUser.id ? { ...frontendUser, status } : null;
    },
    async removeById(id) {
      calls.frontRemove = id;
      return id === frontendUser.id;
    }
  };
  const authService = {
    async login(email, password) {
      calls.login = { email, password };
      if (password !== 'CorrectPassword123!') {
        throw Object.assign(new Error('El email o la contraseña no son correctos.'), { status: 401, code: 'INVALID_CREDENTIALS' });
      }
      return email === 'viewer@empresa.cl' ? { ...sessionUser, email, role: 'Usuario' } : sessionUser;
    }
  };
  server = createApp({ userService, authService }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  calls = {};
});

function apiFetch(path, options = {}) {
  // Añade el token de prueba a las solicitudes protegidas.
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${process.env.API_TOKEN}`);
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function sessionFetch(path, options = {}, email = 'admin@empresa.cl') {
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'CorrectPassword123!' })
  });
  const { token } = await loginResponse.json();
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${token}`);
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

test('health endpoint reports API status', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('serves the frontend entry page from the backend process', async () => {
  const response = await fetch(`${baseUrl}/app.html`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /GestioApp/);
  assert.match(html, /js\/backend-config\.js/);
  const configResponse = await fetch(`${baseUrl}/js/backend-config.js`);
  assert.equal(configResponse.status, 200);
  assert.match(await configResponse.text(), /baseUrl: '\/api\/v1'/);
});

test('protects API routes with a bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/users`);
  assert.equal(response.status, 401);
});

test('lists users with validated pagination', async () => {
  const response = await apiFetch('/api/users?limit=10&offset=5');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.list, { limit: 10, offset: 5 });
  assert.equal(body.data[0].username, 'ana');
  assert.equal(body.pagination.hasMore, false);
});

test('rejects invalid pagination and usernames', async () => {
  assert.equal((await apiFetch('/api/users?limit=1000')).status, 400);
  assert.equal((await apiFetch('/api/users/ana%2A')).status, 400);
});

test('creates a validated user and returns 201', async () => {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'ana', userPrincipalName: 'ana@example.com', password: 'StrongPass123',
      givenName: 'Ana', surname: 'Perez', displayName: 'Ana Perez', enabled: true
    })
  });
  assert.equal(response.status, 201);
  assert.equal(calls.create.password, 'StrongPass123');
  assert.equal((await response.json()).data.username, 'ana');
});

test('does not call create for invalid user payloads', async () => {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'bad name', password: 'short' })
  });
  assert.equal(response.status, 400);
  assert.equal(calls.create, undefined);
});

test('rejects legacy passwords that do not meet the three-group complexity rule', async () => {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'ana', userPrincipalName: 'ana@example.com', password: 'password',
      givenName: 'Ana', surname: 'Perez', displayName: 'Ana Perez', enabled: true
    })
  });

  assert.equal(response.status, 400);
  assert.equal(calls.create, undefined);
});

test('reads a user and returns 404 when absent', async () => {
  assert.equal((await apiFetch('/api/users/ana')).status, 200);
  assert.equal((await apiFetch('/api/users/unknown')).status, 404);
});

test('updates a user and rejects an empty patch', async () => {
  const response = await apiFetch('/api/users/ana', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.update, { username: 'ana', data: { enabled: false } });
  assert.equal((await apiFetch('/api/users/ana', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
});

test('rejects a legacy password change that does not meet complexity rules', async () => {
  const response = await apiFetch('/api/users/ana', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'password' })
  });

  assert.equal(response.status, 400);
  assert.equal(calls.update, undefined);
});

test('deletes an existing user and reports a missing one', async () => {
  assert.equal((await apiFetch('/api/users/ana', { method: 'DELETE' })).status, 204);
  assert.equal((await apiFetch('/api/users/unknown', { method: 'DELETE' })).status, 404);
});

test('lists users using the frontend response model', async () => {
  const response = await sessionFetch('/api/v1/users');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { items: [frontendUser], total: 1 });
});

test('creates frontend users and validates the Chilean RUT', async () => {
  const response = await sessionFetch('/api/v1/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Ana Pérez', rut: '16234567-2', email: 'ana.perez@empresa.cl',
      password: 'StrongPass123', role: 'Usuario', area: 'RRHH'
    })
  });
  assert.equal(response.status, 201);
  assert.equal(calls.frontCreate.rut, '16.234.567-2');
  assert.equal((await response.json()).name, 'Ana Pérez');

  const invalid = await sessionFetch('/api/v1/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Ana Pérez', rut: '16.234.567-3', email: 'ana.perez@empresa.cl',
      password: 'StrongPass123!', role: 'Usuario', area: 'RRHH'
    })
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).errors.rut, 'Ingrese un RUT válido.');
});

test('rejects frontend user creation with a password shorter than eight characters', async () => {
  const response = await sessionFetch('/api/v1/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Ana Pérez', rut: '16234567-2', email: 'ana.perez@empresa.cl',
      password: 'Abc1234', role: 'Usuario', area: 'RRHH'
    })
  });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).errors.password, 'String must contain at least 8 character(s)');
});

test('rejects frontend passwords without three character groups on create and update', async () => {
  const payload = {
    name: 'Ana Pérez', rut: '16234567-2', email: 'ana.perez@empresa.cl',
    password: 'password', role: 'Usuario', area: 'RRHH'
  };
  const create = await sessionFetch('/api/v1/users', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  assert.equal(create.status, 422);
  assert.equal((await create.json()).errors.password, 'La contraseña debe incluir caracteres de al menos 3 de estos 4 grupos: mayúsculas, minúsculas, números y símbolos.');

  const update = await sessionFetch(`/api/v1/users/${frontendUser.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, password: 'password' })
  });
  assert.equal(update.status, 422);
  assert.equal((await update.json()).errors.password, 'La contraseña debe incluir caracteres de al menos 3 de estos 4 grupos: mayúsculas, minúsculas, números y símbolos.');
});

test('updates and changes status by the frontend user id', async () => {
  const path = `/api/v1/users/${frontendUser.id}`;
  const update = await sessionFetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ana Pérez', rut: frontendUser.rut, email: frontendUser.email, role: 'Usuario', area: 'RRHH' })
  });
  assert.equal(update.status, 200);
  assert.equal(calls.frontUpdate.id, frontendUser.id);

  const status = await sessionFetch(`${path}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'disabled' })
  });
  assert.equal(status.status, 200);
  assert.deepEqual(calls.frontStatus, { id: frontendUser.id, status: 'disabled' });
});

test('reports backup capability as unavailable instead of returning mock data', async () => {
  const response = await sessionFetch(`/api/v1/users/${frontendUser.id}/backups`);
  assert.equal(response.status, 501);
  assert.equal((await response.json()).code, 'BACKUPS_UNAVAILABLE');
});

test('authenticates, returns the current user, and revokes sessions on logout', async () => {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@empresa.cl', password: 'CorrectPassword123!' })
  });
  const { token, user: loggedInUser } = await login.json();
  assert.equal(login.status, 200);
  assert.ok(token);
  assert.deepEqual(loggedInUser, sessionUser);

  const headers = { authorization: `Bearer ${token}` };
  const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), sessionUser);

  const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/me`, { headers })).status, 401);
});

test('rejects invalid credentials and protects login from malformed input', async () => {
  const invalidCredentials = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@empresa.cl', password: 'wrong' })
  });
  assert.equal(invalidCredentials.status, 401);
  assert.equal((await invalidCredentials.json()).code, 'INVALID_CREDENTIALS');

  const malformed = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bad', password: '' })
  });
  assert.equal(malformed.status, 422);
});

test('requires a frontend permission for versioned user operations', async () => {
  const response = await sessionFetch('/api/v1/users', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
  }, 'viewer@empresa.cl');
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'FORBIDDEN');
});