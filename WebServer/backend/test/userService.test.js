import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserService } from '../src/services/userService.js';

const id = '1234567890abcdef1234567890abcdef';

test('maps frontend user fields to Samba AD attributes', async () => {
  let created;
  const repository = {
    async findByUsername() { return null; },
    async findByEmail() { return null; },
    async findByRut() { return null; },
    async create(data) { created = data; return { ...data, id }; }
  };
  const service = new UserService(repository);
  const user = await service.createFrontend({
    name: 'Ana Pérez', rut: '16.234.567-2', email: 'ana.perez@empresa.cl',
    password: 'ClaveSegura123', role: 'Supervisor', area: 'RRHH'
  });

  assert.equal(created.username, 'ana.perez');
  assert.equal(created.givenName, 'Ana');
  assert.equal(created.surname, 'Pérez');
  assert.equal(created.displayName, 'Ana Pérez');
  assert.equal(created.userPrincipalName, 'ana.perez@empresa.cl');
  assert.equal(created.rut, '16.234.567-2');
  assert.equal(created.role, 'Supervisor');
  assert.equal(created.department, 'RRHH');
  assert.equal(created.password, 'ClaveSegura123');
  assert.deepEqual(user, {
    id, name: 'Ana Pérez', rut: '16.234.567-2', email: 'ana.perez@empresa.cl',
    role: 'Supervisor', area: 'RRHH', status: 'active', assetCount: 0,
    lastAccess: null, avgConnectionMin: null
  });
});

test('rejects a new password containing a part of the users full name', async () => {
  let created = false;
  const repository = {
    async findByUsername() { return null; },
    async findByEmail() { return null; },
    async findByRut() { return null; },
    async create() { created = true; }
  };
  const service = new UserService(repository);

  await assert.rejects(
    service.createFrontend({
      name: 'Cristobal Seguel', rut: '16.234.567-2', email: 'externo@empresa.cl',
      password: 'SecureCristobal9!', role: 'Usuario', area: 'RRHH'
    }),
    (error) => error.status === 422 && error.errors.password.includes('nombre personal')
  );
  assert.equal(created, false);
});

test('rejects a changed password containing a part of the existing account name', async () => {
  const currentUser = {
    id, username: 'cristobal.seguel', displayName: 'Otro Usuario', role: 'Usuario', enabled: true
  };
  let updated = false;
  const repository = {
    async findById() { return currentUser; },
    async findByEmail() { return null; },
    async findByRut() { return null; },
    async updateById() { updated = true; return currentUser; }
  };
  const service = new UserService(repository);

  await assert.rejects(
    service.updateFrontend(id, {
      name: 'Otro Usuario', rut: '16.234.567-2', email: 'nuevo@empresa.cl',
      password: 'SecureCristobal9!', role: 'Usuario', area: 'RRHH'
    }),
    (error) => error.status === 422 && error.errors.password.includes('nombre de cuenta')
  );
  assert.equal(updated, false);
});

test('prevents removing the role from the last active administrator', async () => {
  const admin = {
    id, username: 'admin', displayName: 'Admin', rut: '15.678.901-1',
    email: 'admin@empresa.cl', role: 'Administrador', department: 'TI', enabled: true
  };
  let updated = false;
  const repository = {
    async findById() { return admin; },
    async findByEmail() { return null; },
    async findByRut() { return null; },
    async list() { return { users: [admin], hasMore: false }; },
    async updateById() { updated = true; return admin; }
  };
  const service = new UserService(repository);

  await assert.rejects(
    service.updateFrontend(id, {
      name: 'Admin', rut: '15.678.901-1', email: 'admin@empresa.cl', role: 'Usuario', area: 'TI'
    }),
    (error) => error.status === 409 && error.code === 'LAST_ADMIN'
  );
  assert.equal(updated, false);
});