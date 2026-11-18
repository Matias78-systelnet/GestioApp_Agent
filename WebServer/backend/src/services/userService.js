import { UserRepository } from '../ldap/userRepository.js';
import { containsAccountOrName } from './passwordPolicy.js';

const PAGE_SIZE = 100;

function frontendUser(user) {
  return {
    id: user.id,
    name: user.displayName,
    rut: user.rut,
    email: user.email,
    role: user.role,
    area: user.department,
    status: user.enabled ? 'active' : 'disabled',
    assetCount: 0,
    lastAccess: null,
    avgConnectionMin: null
  };
}

function toDirectoryData(data) {
  const words = data.name.trim().split(/\s+/);
  const username = (data.email.split('@')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '.').replace(/^[._-]+|[._-]+$/g, '').slice(0, 20)).toLowerCase();
  if (!username) {
    throw Object.assign(new Error('El correo no permite generar un nombre de cuenta.'), {
      status: 422, code: 'VALIDATION_ERROR', errors: { email: 'Use un correo cuyo nombre antes de @ contenga letras o números.' }
    });
  }
  return {
    username,
    userPrincipalName: data.email,
    password: data.password,
    givenName: words[0],
    surname: words.slice(1).join(' ') || words[0],
    displayName: data.name.trim(),
    email: data.email,
    department: data.area,
    rut: data.rut,
    role: data.role,
    enabled: true
  };
}

function conflict(message, field) {
  return Object.assign(new Error(message), {
    status: 422, code: 'VALIDATION_ERROR', errors: { [field]: message }
  });
}

function validatePasswordIdentity(password, username, fullName) {
  if (password && containsAccountOrName(password, username, fullName)) {
    throw conflict('La contraseña no puede contener el nombre de cuenta ni partes del nombre personal de 3 o más caracteres.', 'password');
  }
}

export class UserService {
  // El repositorio se puede sustituir por un doble en las pruebas HTTP.
  constructor(repository = new UserRepository()) {
    this.repository = repository;
  }

  async list(options) {
    return this.repository.list(options);
  }

  async get(username) {
    return this.repository.findByUsername(username);
  }

  // Evita crear dos cuentas con el mismo sAMAccountName.
  async create(data) {
    validatePasswordIdentity(data.password, data.username, `${data.givenName} ${data.surname}`);
    if (await this.repository.findByUsername(data.username)) {
      throw Object.assign(new Error('El usuario ya existe'), { status: 409, code: 'USER_EXISTS' });
    }
    return this.repository.create(data);
  }

  async update(username, data) {
    if (data.password) {
      const current = await this.repository.findByUsername(username);
      if (!current) return null;
      validatePasswordIdentity(data.password, current.username, current.displayName);
    }
    return this.repository.update(username, data);
  }

  async remove(username) {
    return this.repository.remove(username);
  }

  async listFrontend() {
    const items = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await this.repository.list({ limit: PAGE_SIZE, offset });
      items.push(...page.users);
      offset += page.users.length;
      hasMore = page.hasMore;
    }
    return items.map(frontendUser);
  }

  async getById(id) {
    const user = await this.repository.findById(id);
    return user ? frontendUser(user) : null;
  }

  async assertUnique(data, excludeId = null) {
    const [emailUser, rutUser] = await Promise.all([
      this.repository.findByEmail(data.email),
      this.repository.findByRut(data.rut)
    ]);
    if (emailUser && emailUser.id !== excludeId) throw conflict('Ya existe un usuario con ese email.', 'email');
    if (rutUser && rutUser.id !== excludeId) throw conflict('Ya existe un usuario con ese RUT.', 'rut');
  }

  async activeAdminCount() {
    const users = await this.listFrontend();
    return users.filter((user) => user.role === 'Administrador' && user.status === 'active').length;
  }

  async createFrontend(data) {
    const directoryData = toDirectoryData(data);
    validatePasswordIdentity(directoryData.password, directoryData.username, directoryData.displayName);
    if (await this.repository.findByUsername(directoryData.username)) {
      throw conflict('Ya existe una cuenta con el correo indicado.', 'email');
    }
    await this.assertUnique(data);
    return frontendUser(await this.repository.create(directoryData));
  }

  async updateFrontend(id, data) {
    const current = await this.repository.findById(id);
    if (!current) return null;
    validatePasswordIdentity(data.password, current.username, current.displayName);
    await this.assertUnique(data, id);
    if (current.role === 'Administrador' && current.enabled && data.role !== 'Administrador'
      && await this.activeAdminCount() <= 1) {
      throw Object.assign(new Error('No puede quitar el rol al último administrador activo.'), {
        status: 409, code: 'LAST_ADMIN'
      });
    }
    const changes = toDirectoryData(data);
    delete changes.enabled;
    return frontendUser(await this.repository.updateById(id, changes));
  }

  async setStatusById(id, status) {
    const current = await this.repository.findById(id);
    if (!current) return null;
    if (status === 'disabled' && current.role === 'Administrador' && current.enabled
      && await this.activeAdminCount() <= 1) {
      throw Object.assign(new Error('No puede deshabilitar al último administrador activo.'), {
        status: 409, code: 'LAST_ADMIN'
      });
    }
    const updated = await this.repository.updateById(id, { enabled: status === 'active' });
    return updated ? frontendUser(updated) : null;
  }

  async removeById(id) {
    const current = await this.repository.findById(id);
    if (!current) return false;
    if (current.role === 'Administrador' && current.enabled && await this.activeAdminCount() <= 1) {
      throw Object.assign(new Error('No puede eliminar al último administrador activo.'), {
        status: 409, code: 'LAST_ADMIN'
      });
    }
    return this.repository.removeById(id);
  }
}