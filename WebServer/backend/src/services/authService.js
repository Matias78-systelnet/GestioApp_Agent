import { UserRepository } from '../ldap/userRepository.js';
import { config } from '../config.js';

const ROLE_PRIORITY = [
  ['Administrador', 'admin'],
  ['Supervisor', 'supervisor'],
  ['Usuario', 'user']
];

function normalizeDn(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

function roleFromSecurityGroups(groups, roleGroupDns) {
  const memberships = new Set((groups ?? []).map(normalizeDn));
  for (const [role, groupKey] of ROLE_PRIORITY) {
    const groupDn = roleGroupDns[groupKey];
    if (groupDn && memberships.has(normalizeDn(groupDn))) return role;
  }
  return 'Usuario';
}

function toSessionUser(user, roleGroupDns) {
  return {
    id: user.id,
    name: user.displayName,
    email: user.email,
    role: roleFromSecurityGroups(user.securityGroups, roleGroupDns),
    area: user.department
  };
}

export class AuthService {
  constructor(repository = new UserRepository(), roleGroupDns = {
    admin: config.AUTH_GROUP_ADMIN_DN,
    supervisor: config.AUTH_GROUP_SUPERVISOR_DN,
    user: config.AUTH_GROUP_USER_DN
  }) {
    this.repository = repository;
    this.roleGroupDns = roleGroupDns;
  }

  async login(email, password) {
    const result = await this.repository.authenticateByEmail(email, password);
    if (!result) {
      throw Object.assign(new Error('El email o la contraseña no son correctos.'), {
        status: 401, code: 'INVALID_CREDENTIALS'
      });
    }
    if (result.disabled) {
      throw Object.assign(new Error('Esta cuenta está deshabilitada. Contacte a su administrador.'), {
        status: 403, code: 'ACCOUNT_DISABLED'
      });
    }
    return toSessionUser(result, this.roleGroupDns);
  }
}