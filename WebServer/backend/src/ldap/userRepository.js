import { AndFilter, Attribute, Change, EqualityFilter } from 'ldapts';
import { config } from '../config.js';
import { createLdapClient, withLdapClient } from './client.js';
import { syncRoleGroupMembership } from './roleGroups.js';

const USER_ATTRIBUTES = [
  'sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'department', 'title',
  'employeeID', 'employeeType', 'userAccountControl', 'objectGUID'
];

// LDAP puede entregar un atributo como valor único o como arreglo.
function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Expone solo los campos permitidos por la API; nunca incluye atributos de contraseña.
function mapEntry(entry) {
  return {
    id: Buffer.isBuffer(entry.objectGUID) ? entry.objectGUID.toString('hex') : String(first(entry.objectGUID) ?? ''),
    username: String(first(entry.sAMAccountName) ?? ''),
    givenName: String(first(entry.givenName) ?? ''),
    surname: String(first(entry.sn) ?? ''),
    displayName: String(first(entry.displayName) ?? ''),
    email: String(first(entry.mail) ?? ''),
    department: String(first(entry.department) ?? ''),
    title: String(first(entry.title) ?? ''),
    rut: String(first(entry.employeeID) ?? ''),
    role: String(first(entry.employeeType) ?? ''),
    enabled: (Number(first(entry.userAccountControl)) & 2) === 0
  };
}

// Escapa caracteres reservados de un RDN antes de construir el DN del usuario.
function escapeRdn(value) {
  return value.replace(/([,\\#+<>;"=])/g, '\\$1').replace(/^ | $/g, (space) => `\\${space}`);
}

// Samba AD espera unicodePwd como una cadena entre comillas codificada en UTF-16LE.
function passwordValue(password) {
  return Buffer.from(`"${password}"`, 'utf16le');
}

// Escapa caracteres especiales de RFC 4515 para impedir inyección en filtros LDAP.
function escapeFilterValue(value) {
  return value.replace(/[\0()*\\]/g, (character) => `\\${character.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

// Limita la búsqueda a objetos de usuario dentro de la OU configurada.
function userFilter(username) {
  return `(&(objectCategory=person)(objectClass=user)(sAMAccountName=${escapeFilterValue(username)}))`;
}

function guidFilter(id) {
  const bytes = Buffer.from(id, 'hex');
  return new AndFilter({
    filters: [
      new EqualityFilter({ attribute: 'objectCategory', value: 'person' }),
      new EqualityFilter({ attribute: 'objectClass', value: 'user' }),
      new EqualityFilter({ attribute: 'objectGUID', value: bytes })
    ]
  });
}

// Traduce únicamente los campos editables de la API a cambios LDAP.
function toChanges(data) {
  const fields = {
    givenName: 'givenName',
    surname: 'sn',
    displayName: 'displayName',
    email: 'mail',
    department: 'department',
    title: 'title',
    rut: 'employeeID',
    role: 'employeeType',
    userPrincipalName: 'userPrincipalName'
  };
  return Object.entries(fields)
    .filter(([key]) => data[key] !== undefined)
    .map(([key, attribute]) => new Change({
      operation: 'replace',
      modification: new Attribute({ type: attribute, values: [data[key]] })
    }));
}

export class UserRepository {
  async findOne(filter) {
    return withLdapClient(async (client) => {
      const { searchEntries } = await client.search(config.LDAP_USERS_OU, {
        scope: 'sub', filter, attributes: [...USER_ATTRIBUTES, 'distinguishedName'], sizeLimit: 1
      });
      const entry = searchEntries[0];
      return entry ? { ...mapEntry(entry), dn: entry.dn ?? first(entry.distinguishedName) } : null;
    });
  }

  // Busca una cuenta por nombre y conserva su DN internamente para modificaciones.
  async findByUsername(username) {
    return this.findOne(userFilter(username));
  }

  async findById(id) {
    return this.findOne(guidFilter(id));
  }

  async findByEmail(email) {
    return this.findOne(`(&(objectCategory=person)(objectClass=user)(mail=${escapeFilterValue(email)}))`);
  }

  async authenticateByEmail(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    if (!user.enabled) return { disabled: true };

    const client = createLdapClient();
    try {
      await client.bind(user.dn, password);
    } catch (error) {
      if (error.code === 49 || error.resultCode === 49 || String(error.code) === '49'
        || /invalid credentials/i.test(error.message ?? '')) return null;
      throw Object.assign(new Error('No fue posible validar las credenciales con el directorio.'), {
        status: 503, code: 'LDAP_AUTH_UNAVAILABLE', cause: error
      });
    } finally {
      await client.unbind().catch(() => {});
    }
    const securityGroups = await this.findRoleSecurityGroups(user.dn);
    return { ...user, securityGroups };
  }

  async findRoleSecurityGroups(userDn) {
    const configuredGroups = [
      config.AUTH_GROUP_ADMIN_DN,
      config.AUTH_GROUP_SUPERVISOR_DN,
      config.AUTH_GROUP_USER_DN
    ].filter(Boolean);
    if (!configuredGroups.length) return [];

    return withLdapClient(async (client) => {
      const memberships = [];
      for (const groupDn of configuredGroups) {
        const { searchEntries } = await client.search(groupDn, {
          scope: 'base',
          filter: `(&(objectClass=group)(groupType:1.2.840.113556.1.4.803:=2147483648)(member:1.2.840.113556.1.4.1941:=${escapeFilterValue(userDn)}))`,
          attributes: ['distinguishedName'],
          sizeLimit: 1
        });
        if (searchEntries.length) memberships.push(groupDn);
      }
      return memberships;
    });
  }

  async findByRut(rut) {
    return this.findOne(`(&(objectCategory=person)(objectClass=user)(employeeID=${escapeFilterValue(rut)}))`);
  }

  // Recorre páginas LDAP y conserva solo offset + limit + un registro para hasMore.
  async list({ offset, limit }) {
    return withLdapClient(async (client) => {
      const users = [];
      let index = 0;
      let hasMore = false;
      const pages = client.searchPaginated(config.LDAP_USERS_OU, {
        scope: 'sub',
        filter: '(&(objectCategory=person)(objectClass=user))',
        attributes: USER_ATTRIBUTES,
        paged: { pageSize: Math.min(limit + offset + 1, 500) },
        sizeLimit: 0
      });
      for await (const page of pages) {
        for (const entry of page.searchEntries) {
          if (index >= offset && users.length < limit + 1) users.push(mapEntry(entry));
          index += 1;
          if (users.length > limit) {
            hasMore = true;
            break;
          }
        }
        if (hasMore) break;
      }
      return { users: users.slice(0, limit), hasMore };
    });
  }

  // Crea la cuenta y luego establece la contraseña por LDAPS según el requisito de AD.
  async create(data) {
    return withLdapClient(async (client) => {
      if (new URL(config.LDAP_URL).protocol !== 'ldaps:') {
        throw Object.assign(new Error('Crear usuarios con contrasena requiere LDAPS'), { code: 'LDAPS_REQUIRED' });
      }
      const dn = `CN=${escapeRdn(data.username)},${config.LDAP_USERS_OU}`;
      const entry = {
        objectClass: ['top', 'person', 'organizationalPerson', 'user'],
        cn: data.username,
        sAMAccountName: data.username,
        userPrincipalName: data.userPrincipalName,
        givenName: data.givenName,
        sn: data.surname,
        displayName: data.displayName,
        mail: data.email,
        department: data.department,
        title: data.title,
        employeeID: data.rut,
        employeeType: data.role,
        userAccountControl: data.enabled ? '512' : '514'
      };
      for (const key of Object.keys(entry)) {
        if (entry[key] === undefined || entry[key] === '') delete entry[key];
      }
      await client.add(dn, entry);
      await client.modify(dn, new Change({
        operation: 'replace',
        modification: new Attribute({ type: 'unicodePwd', values: [passwordValue(data.password)] })
      }));
      if (data.role !== undefined) await syncRoleGroupMembership(client, dn, data.role);
      return this.findByUsername(data.username);
    });
  }

  // Actualiza atributos, contraseña o el bit de cuenta deshabilitada sin alterar otros bits.
  async updateUser(user, data) {
    const changes = toChanges(data);
    if (data.enabled !== undefined) {
      const current = await withLdapClient(async (client) => {
        const { searchEntries } = await client.search(user.dn, {
          scope: 'base', filter: '(objectClass=user)', attributes: ['userAccountControl'], sizeLimit: 1
        });
        return Number(first(searchEntries[0]?.userAccountControl) ?? 512);
      });
      const updated = data.enabled ? current & ~2 : current | 2;
      changes.push(new Change({ operation: 'replace', modification: new Attribute({ type: 'userAccountControl', values: [String(updated)] }) }));
    }
    if (data.password) {
      if (new URL(config.LDAP_URL).protocol !== 'ldaps:') {
        throw Object.assign(new Error('Cambiar contrasenas requiere LDAPS'), { code: 'LDAPS_REQUIRED' });
      }
      changes.push(new Change({ operation: 'replace', modification: new Attribute({ type: 'unicodePwd', values: [passwordValue(data.password)] }) }));
    }
    if (changes.length) {
      await withLdapClient((client) => client.modify(user.dn, changes));
    }
    if (data.role !== undefined) {
      await withLdapClient((client) => syncRoleGroupMembership(client, user.dn, data.role));
    }
    return this.findById(user.id);
  }

  async update(username, data) {
    const user = await this.findByUsername(username);
    return user ? this.updateUser(user, data) : null;
  }

  async updateById(id, data) {
    const user = await this.findById(id);
    return user ? this.updateUser(user, data) : null;
  }

  // El borrado LDAP requiere un DN; resuelve ese DN mediante mail y confirma la identidad.
  async removeByEmail(email, expectedId) {
    if (!email) return false;
    const user = await this.findByEmail(email);
    if (!user || user.id !== expectedId) return false;
    await withLdapClient((client) => client.del(user.dn));
    return true;
  }

  // Elimina la cuenta encontrada; devuelve false si no existía.
  async remove(username) {
    const user = await this.findByUsername(username);
    if (!user) return false;
    return this.removeByEmail(user.email, user.id);
  }

  async removeById(id) {
    const user = await this.findById(id);
    if (!user) return false;
    return this.removeByEmail(user.email, user.id);
  }
}