import { Attribute, Change } from 'ldapts';
import { config } from '../config.js';

const ROLE_GROUPS = [
  { role: 'Administrador', configKey: 'AUTH_GROUP_ADMIN_DN' },
  { role: 'Supervisor', configKey: 'AUTH_GROUP_SUPERVISOR_DN' },
  { role: 'Usuario', configKey: 'AUTH_GROUP_USER_DN' }
];

function roleGroupError(message) {
  return Object.assign(new Error(message), { status: 503, code: 'ROLE_GROUPS_UNAVAILABLE' });
}

export async function syncRoleGroupMembership(client, userDn, role) {
  const selectedGroup = ROLE_GROUPS.find((group) => group.role === role);
  if (!selectedGroup) throw roleGroupError('El rol indicado no tiene un grupo de AD asociado.');

  const groups = ROLE_GROUPS.map((group) => ({ ...group, dn: config[group.configKey] }));
  if (groups.some((group) => !group.dn)) {
    throw roleGroupError('Configure los DN de los tres grupos de rol de Samba AD.');
  }

  const memberships = [];
  for (const group of groups) {
    const { searchEntries } = await client.search(group.dn, {
      scope: 'base',
      filter: '(&(objectClass=group)(groupType:1.2.840.113556.1.4.803:=2147483648))',
      attributes: ['member'],
      sizeLimit: 1
    });
    if (!searchEntries.length) throw roleGroupError(`No se encontró el grupo de seguridad configurado para ${group.role}.`);
    const members = searchEntries[0].member ?? [];
    memberships.push({
      ...group,
      containsUser: (Array.isArray(members) ? members : [members])
        .some((member) => String(member).toLocaleLowerCase('en-US') === userDn.toLocaleLowerCase('en-US'))
    });
  }

  const selected = memberships.find((group) => group.role === selectedGroup.role);
  if (!selected.containsUser) {
    await client.modify(selected.dn, new Change({
      operation: 'add',
      modification: new Attribute({ type: 'member', values: [userDn] })
    }));
  }
  for (const group of memberships) {
    if (group.role === selectedGroup.role || !group.containsUser) continue;
    await client.modify(group.dn, new Change({
      operation: 'delete',
      modification: new Attribute({ type: 'member', values: [userDn] })
    }));
  }
}