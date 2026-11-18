import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.LDAP_URL = 'ldaps://localhost:636';
process.env.LDAP_BIND_DN = 'CN=test,DC=example,DC=com';
process.env.LDAP_BIND_PASSWORD = 'test-only';
process.env.API_TOKEN = 'test-token-with-more-than-thirty-two-characters';
process.env.LDAP_BASE_DN = 'DC=example,DC=com';
process.env.LDAP_USERS_OU = 'OU=Users,DC=example,DC=com';
process.env.AUTH_GROUP_ADMIN_DN = 'CN=GG_Administradores,OU=Grupos,DC=example,DC=com';
process.env.AUTH_GROUP_SUPERVISOR_DN = 'CN=GG_Supervisores,OU=Grupos,DC=example,DC=com';
process.env.AUTH_GROUP_USER_DN = 'CN=GG_usuario,OU=Grupos,DC=example,DC=com';

const { syncRoleGroupMembership } = await import('../src/ldap/roleGroups.js');
const { config } = await import('../src/config.js');
const userDn = 'CN=Ana,OU=Usuarios,DC=example,DC=com';

function fakeClient(membersByDn) {
  const changes = [];
  return {
    changes,
    async search(dn) {
      return { searchEntries: [{ member: membersByDn[dn] ?? [] }] };
    },
    async modify(dn, change) {
      changes.push({ dn, operation: change.operation, attribute: change.modification.type, value: change.modification.values[0] });
    }
  };
}

test('adds user to selected role group and removes previous role memberships', async () => {
  const adminDn = process.env.AUTH_GROUP_ADMIN_DN;
  const supervisorDn = process.env.AUTH_GROUP_SUPERVISOR_DN;
  const userDnGroup = process.env.AUTH_GROUP_USER_DN;
  const client = fakeClient({ [adminDn]: [userDn], [supervisorDn]: [], [userDnGroup]: [] });

  await syncRoleGroupMembership(client, userDn, 'Supervisor');

  assert.deepEqual(client.changes, [
    { dn: supervisorDn, operation: 'add', attribute: 'member', value: userDn },
    { dn: adminDn, operation: 'delete', attribute: 'member', value: userDn }
  ]);
});

test('keeps membership idempotent when user is already in the selected group', async () => {
  const supervisorDn = process.env.AUTH_GROUP_SUPERVISOR_DN;
  const client = fakeClient({ [supervisorDn]: [userDn] });

  await syncRoleGroupMembership(client, userDn, 'Supervisor');

  assert.deepEqual(client.changes, []);
});

test('fails clearly if role group DNs are not all configured', async () => {
  const original = config.AUTH_GROUP_USER_DN;
  config.AUTH_GROUP_USER_DN = '';
  try {
    await assert.rejects(
      syncRoleGroupMembership(fakeClient({}), userDn, 'Usuario'),
      (error) => error.status === 503 && error.code === 'ROLE_GROUPS_UNAVAILABLE'
    );
  } finally {
    config.AUTH_GROUP_USER_DN = original;
  }
});