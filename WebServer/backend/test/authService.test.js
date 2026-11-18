import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from '../src/services/authService.js';

const roleGroupDns = {
  admin: 'CN=GestioApp-Administradores,OU=Grupos,DC=example,DC=com',
  supervisor: 'CN=GestioApp-Supervisores,OU=Grupos,DC=example,DC=com',
  user: 'CN=GestioApp-Usuarios,OU=Grupos,DC=example,DC=com'
};

test('maps an authenticated LDAP user to the frontend session model', async () => {
  const repository = {
    async authenticateByEmail(email, password) {
      assert.equal(email, 'ana@empresa.cl');
      assert.equal(password, 'correct-password');
      return {
        id: '1234567890abcdef1234567890abcdef', displayName: 'Ana Pérez',
        email, employeeType: 'Administrador', department: 'RRHH',
        securityGroups: [roleGroupDns.supervisor.toLowerCase()]
      };
    }
  };
  const user = await new AuthService(repository, roleGroupDns).login('ana@empresa.cl', 'correct-password');
  assert.deepEqual(user, {
    id: '1234567890abcdef1234567890abcdef', name: 'Ana Pérez',
    email: 'ana@empresa.cl', role: 'Supervisor', area: 'RRHH'
  });
});

test('uses least privilege for unknown LDAP roles', async () => {
  const service = new AuthService({
    async authenticateByEmail() {
      return { id: 'abc', displayName: 'Cuenta', email: 'cuenta@empresa.cl', role: 'Domain Admins', department: 'TI' };
    }
  });
  assert.equal((await service.login('cuenta@empresa.cl', 'password')).role, 'Usuario');
});

test('prefers the highest privilege when a user belongs to multiple role groups', async () => {
  const service = new AuthService({
    async authenticateByEmail() {
      return {
        id: 'abc', displayName: 'Ana', email: 'ana@empresa.cl', department: 'TI',
        securityGroups: [roleGroupDns.user, roleGroupDns.admin, roleGroupDns.supervisor]
      };
    }
  }, roleGroupDns);
  assert.equal((await service.login('ana@empresa.cl', 'password')).role, 'Administrador');
});

test('defaults to Usuario when no configured role security group matches', async () => {
  const service = new AuthService({
    async authenticateByEmail() {
      return {
        id: 'abc', displayName: 'Ana', email: 'ana@empresa.cl', department: 'TI',
        securityGroups: ['CN=Otro-Grupo,OU=Grupos,DC=example,DC=com']
      };
    }
  }, roleGroupDns);
  assert.equal((await service.login('ana@empresa.cl', 'password')).role, 'Usuario');
});

test('returns frontend-compatible invalid-credential and disabled-account errors', async () => {
  const invalid = new AuthService({ async authenticateByEmail() { return null; } });
  await assert.rejects(invalid.login('nadie@empresa.cl', 'wrong'), (error) => error.status === 401 && error.code === 'INVALID_CREDENTIALS');

  const disabled = new AuthService({ async authenticateByEmail() { return { disabled: true }; } });
  await assert.rejects(disabled.login('deshabilitado@empresa.cl', 'password'), (error) => error.status === 403 && error.code === 'ACCOUNT_DISABLED');
});