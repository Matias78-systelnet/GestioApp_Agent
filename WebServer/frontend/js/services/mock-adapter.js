/* ═══ services/mock-adapter.js — "Servidor" simulado sobre localStorage ═══
 * Implementa EXACTAMENTE la misma interfaz que el adaptador HTTP (ver services/api.js)
 * y se comporta como debería hacerlo el backend: valida, responde errores con
 * ApiError (status + fieldErrors) y registra la auditoría de cada cambio.
 * Sirve como referencia ejecutable del contrato descrito en docs/API.md.
 */

const MockApi = (() => {
  const K = CONFIG.mock.storageKeys;
  const DATA_VERSION_KEY = 'gestio_data_version';
  const DATA_VERSION = 6;   // v5: ficha técnica + Dell Latitude 5440 · v6: datos completos de la Hardware Asset Card

  const wait = () => new Promise(r => setTimeout(r, CONFIG.mock.latencyMs));
  const clone = v => JSON.parse(JSON.stringify(v));
  const nextId = list => (list.length ? Math.max(...list.map(i => Number(i.id) || 0)) + 1 : 1);
  const findIndex = (list, id) => list.findIndex(i => Utils.sameId(i.id, id));

  /* ── Migración de datos guardados por versiones anteriores (v1/v2) ── */
  const OLD_SEED_RUTS = { '12.345.678-9': '12.345.678-5', '13.456.789-0': '13.456.789-9', '14.567.890-1': '14.567.890-0', '15.678.901-2': '15.678.901-1' };

  function migrate() {
    if (Utils.load(DATA_VERSION_KEY) >= DATA_VERSION) return;
    let users = Utils.load(K.users);
    let assets = Utils.load(K.assets);
    let audit = Utils.load(K.audit);

    if (Array.isArray(users)) {
      users = users.map(u => ({
        id: u.id, name: u.name, rut: OLD_SEED_RUTS[u.rut] || u.rut, email: u.email, role: u.role, area: u.area,
        status: u.status === 'disabled' ? 'disabled' : 'active',
        assetCount: u.assetCount ?? u.activos ?? 0,
        lastAccess: u.lastAccess || null,
        avgConnectionMin: u.avgConnectionMin ?? (MockData.users().find(s => Utils.sameId(s.id, u.id))?.avgConnectionMin ?? null),
      }));
      Utils.store(K.users, users);
    }
    if (Array.isArray(assets)) {
      assets = assets.map(a => {
        let assignedTo = a.assignedTo || null;
        if (!assignedTo && a.responsible && a.responsible !== '—') {
          const u = (users || []).find(x => x.name === a.responsible);
          assignedTo = { id: u ? u.id : null, name: a.responsible };
        }
        return {
          ...pickDetail(a),   // conserva la ficha técnica si el activo ya la tenía
          id: a.id, name: a.name, type: a.type, serial: a.serial, location: a.location,
          value: Utils.parseMoney(a.value), assignedTo, status: assignedTo ? 'Asignado' : 'Disponible',
        };
      });
      Utils.store(K.assets, assets);
    }
    if (Array.isArray(audit)) {
      audit = audit.map((e, i) => {
        if (e.timestamp) return e;
        let ts = new Date().toISOString();
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(e.date || '');
        if (m && e.time) ts = new Date(`${m[3]}-${m[2]}-${m[1]}T${e.time}`).toISOString();
        return { id: 'm' + i + '-' + Date.now(), timestamp: ts, type: e.type || 'info', message: e.text || '', actor: null };
      });
      Utils.store(K.audit, audit);
    }
    mergeSeed();
    Utils.store(DATA_VERSION_KEY, DATA_VERSION);
  }

  // Campos opcionales de la ficha técnica (docs/API.md → Asset)
  const DETAIL_FIELDS = ['assetTag', 'brand', 'model', 'segment', 'condition', 'floor', 'specs', 'warrantyPlan', 'warrantyUntil'];
  function pickDetail(a) {
    const out = {};
    DETAIL_FIELDS.forEach(k => { if (a[k] !== undefined) out[k] = a[k]; });
    return out;
  }

  /* Agrega a un localStorage ya existente los registros semilla nuevos (sin pisar datos del usuario).
     Si el id del usuario semilla ya lo ocupa otra persona, se le asigna uno libre y se reasigna el activo. */
  const NEW_SEED = { users: [5], assets: ['AST-2026-014'] };
  function mergeSeed() {
    let users = Utils.load(K.users);
    let assets = Utils.load(K.assets);
    if (!Array.isArray(users) || !Array.isArray(assets)) return;   // sin datos guardados: se usará la semilla completa
    const idMap = {};
    MockData.users().filter(u => NEW_SEED.users.some(id => Utils.sameId(id, u.id))).forEach(u => {
      const same = users.find(x => String(x.email).toLowerCase() === u.email.toLowerCase());
      if (same) { idMap[u.id] = same.id; return; }
      const id = users.some(x => Utils.sameId(x.id, u.id)) ? nextId(users) : u.id;
      idMap[u.id] = id;
      users = [...users, { ...u, id }];
    });
    MockData.assets().filter(a => NEW_SEED.assets.some(id => Utils.sameId(id, a.id))).forEach(a => {
      // Si el activo semilla ya existe, solo se refresca su ficha técnica (no se toca asignación, ubicación ni valor)
      if (assets.some(x => Utils.sameId(x.id, a.id))) { assets = assets.map(x => (Utils.sameId(x.id, a.id) ? { ...x, ...pickDetail(a) } : x)); return; }
      if (assets.some(x => String(x.serial).toLowerCase() === a.serial.toLowerCase())) return;
      const assignedTo = a.assignedTo ? { ...a.assignedTo, id: idMap[a.assignedTo.id] ?? a.assignedTo.id } : null;
      assets = [...assets, { ...a, assignedTo }];
    });
    Utils.store(K.assets, assets);
    Utils.store(K.users, recountAssets(users, assets));
  }

  /* ── Acceso a la "base de datos" ── */
  const db = {
    users: () => Utils.load(K.users) || (Utils.store(K.users, MockData.users()), MockData.users()),
    assets: () => Utils.load(K.assets) || (Utils.store(K.assets, MockData.assets()), MockData.assets()),
    audit: () => Utils.load(K.audit, []),
    saveUsers: l => Utils.store(K.users, l),
    saveAssets: l => Utils.store(K.assets, l),
    saveAudit: l => Utils.store(K.audit, l.slice(0, 500)),
  };

  function recountAssets(users, assets) {
    return users.map(u => ({ ...u, assetCount: assets.filter(a => a.assignedTo && Utils.sameId(a.assignedTo.id, u.id)).length }));
  }

  // El servidor real registra la auditoría; aquí se simula igual.
  function log(message, type = 'info') {
    const actor = Auth.getUser();
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      type,
      message,
      actor: actor ? { id: actor.id, name: actor.name } : null,
    };
    db.saveAudit([entry, ...db.audit()]);
    return entry;
  }

  const fail = (status, message, fieldErrors = null, code = 'ERROR') => {
    throw new ApiError(message, { status, code, fieldErrors });
  };

  const requireSession = () => {
    if (!Auth.getUser()) { Auth.handleUnauthorized(); fail(401, Http.defaultMessage(401), null, 'UNAUTHORIZED'); }
  };

  const requirePermission = (perm) => {
    requireSession();
    if (!Auth.can(perm)) fail(403, Http.defaultMessage(403), null, 'FORBIDDEN');
  };

  migrate();

  return {
    /* ═══ AUTH ═══ */
    auth: {
      async login({ email, password }) {
        await wait();
        const users = db.users();
        const user = users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
        const isAdmin = String(email).toLowerCase() === CONFIG.mock.admin.email && password === CONFIG.mock.admin.password;
        const isDemo = user && password === CONFIG.mock.demoPassword;
        if (!user || !(isAdmin || isDemo)) fail(401, 'El email o la contraseña no son correctos.', null, 'INVALID_CREDENTIALS');
        if (user.status !== 'active') fail(403, 'Esta cuenta está deshabilitada. Contacte a su administrador.', null, 'ACCOUNT_DISABLED');

        user.lastAccess = new Date().toISOString();
        db.saveUsers(users);
        const session = { token: 'mock-' + Math.random().toString(36).slice(2), user: { id: user.id, name: user.name, email: user.email, role: user.role, area: user.area } };
        // log() necesita la sesión: se registra después de guardarla (ver Auth.login)
        return session;
      },
      async logout() { await wait(); return null; },
      async me() {
        await wait();
        requireSession();
        const u = db.users().find(x => Utils.sameId(x.id, Auth.getUser().id));
        if (!u || u.status !== 'active') fail(401, Http.defaultMessage(401), null, 'UNAUTHORIZED');
        return { id: u.id, name: u.name, email: u.email, role: u.role, area: u.area };
      },
    },

    /* ═══ DASHBOARD ═══ */
    dashboard: {
      async summary() {
        await wait();
        requirePermission('dashboard.view');
        const assets = db.assets();
        const users = db.users();
        const audit = db.audit();
        const byType = {};
        assets.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
        const featured = assets.find(a => a.serial === CONFIG.features.featuredAssetSerial)
          || assets.find(a => a.status === 'Asignado') || assets[0] || null;
        const active = users.filter(u => u.status === 'active').length;
        return {
          assets: {
            total: assets.length,
            assigned: assets.filter(a => a.status === 'Asignado').length,
            available: assets.filter(a => a.status === 'Disponible').length,
            byType,
            locations: [...new Set(assets.map(a => a.location))],
          },
          users: { active, disabled: users.length - active, withTwoFactor: active },
          audit: { total: audit.length, latest: audit[0] || null },
          featuredAsset: featured,
          recentActivity: audit.slice(0, CONFIG.features.timelineSize),
        };
      },
    },

    /* ═══ ACTIVOS ═══ */
    assets: {
      async list() {
        await wait();
        requirePermission('assets.view');
        const items = db.assets();
        return { items, total: items.length };
      },

      async create(data) {
        await wait();
        requirePermission('assets.write');
        const assets = db.assets();
        const errors = Validators.asset(data, assets);
        if (Object.keys(errors).length) fail(422, 'Revise los datos ingresados.', errors, 'VALIDATION_ERROR');
        const asset = { id: nextId(assets), name: data.name, type: data.type, serial: data.serial, location: data.location, value: data.value ?? null, status: 'Disponible', assignedTo: null };
        db.saveAssets([...assets, asset]);
        log('Registró activo: ' + asset.name, 'success');
        return clone(asset);
      },

      async update(id, data) {
        await wait();
        requirePermission('assets.write');
        const assets = db.assets();
        const i = findIndex(assets, id);
        if (i < 0) fail(404, 'El activo ya no existe. Recargue la lista.', null, 'NOT_FOUND');
        const errors = Validators.asset(data, assets, id);
        if (Object.keys(errors).length) fail(422, 'Revise los datos ingresados.', errors, 'VALIDATION_ERROR');
        assets[i] = { ...assets[i], name: data.name, type: data.type, serial: data.serial, location: data.location, value: data.value ?? null };
        db.saveAssets(assets);
        log('Modificó activo: ' + assets[i].name, 'info');
        return clone(assets[i]);
      },

      async remove(id) {
        await wait();
        requirePermission('assets.write');
        const assets = db.assets();
        const i = findIndex(assets, id);
        if (i < 0) fail(404, 'El activo ya no existe. Recargue la lista.', null, 'NOT_FOUND');
        const [removed] = assets.splice(i, 1);
        db.saveAssets(assets);
        db.saveUsers(recountAssets(db.users(), assets));
        log('Eliminó activo: ' + removed.name, 'danger');
        return null;
      },

      // userId = null → dejar disponible
      async assign(id, userId) {
        await wait();
        requirePermission('assets.assign');
        const assets = db.assets();
        const users = db.users();
        const i = findIndex(assets, id);
        if (i < 0) fail(404, 'El activo ya no existe. Recargue la lista.', null, 'NOT_FOUND');
        const prev = assets[i].assignedTo;
        if (userId !== null && userId !== undefined && userId !== '') {
          const user = users.find(u => Utils.sameId(u.id, userId));
          if (!user || user.status !== 'active') fail(422, 'El usuario elegido no existe o está deshabilitado.', { userId: 'Elija un usuario activo.' }, 'VALIDATION_ERROR');
          assets[i] = { ...assets[i], assignedTo: { id: user.id, name: user.name }, status: 'Asignado' };
          log(`Asignó "${assets[i].name}" a ${user.name}`, 'info');
        } else {
          assets[i] = { ...assets[i], assignedTo: null, status: 'Disponible' };
          log(`Desasignó "${assets[i].name}"${prev ? ' de ' + prev.name : ''}`, 'warn');
        }
        db.saveAssets(assets);
        db.saveUsers(recountAssets(users, assets));
        return clone(assets[i]);
      },
    },

    /* ═══ USUARIOS ═══ */
    users: {
      async list() {
        await wait();
        requireSession();
        if (!Auth.can('users.view') && !Auth.can('assets.assign')) fail(403, Http.defaultMessage(403), null, 'FORBIDDEN');
        const items = db.users();
        return { items, total: items.length };
      },

      async create(data) {
        await wait();
        requirePermission('users.write');
        const users = db.users();
        const { errors, rut } = Validators.user(data, users);
        if (Object.keys(errors).length) fail(422, 'Revise los datos ingresados.', errors, 'VALIDATION_ERROR');
        const user = { id: nextId(users), name: data.name, rut, email: data.email, role: data.role, area: data.area, status: 'active', assetCount: 0, lastAccess: null, avgConnectionMin: null };
        db.saveUsers([...users, user]);
        log(`Creó usuario: ${user.name} (${user.role}, ${user.area})`, 'success');
        return clone(user);
      },

      async update(id, data) {
        await wait();
        requirePermission('users.write');
        const users = db.users();
        const i = findIndex(users, id);
        if (i < 0) fail(404, 'El usuario ya no existe. Recargue la lista.', null, 'NOT_FOUND');
        const { errors, rut } = Validators.user(data, users, id);
        const current = users[i];
        const admins = users.filter(u => u.role === 'Administrador' && u.status === 'active');
        if (current.role === 'Administrador' && data.role !== 'Administrador' && admins.length <= 1) {
          errors.role = 'Debe quedar al menos un administrador activo.';
        }
        if (Object.keys(errors).length) fail(422, 'Revise los datos ingresados.', errors, 'VALIDATION_ERROR');
        users[i] = { ...current, name: data.name, rut, email: data.email, role: data.role, area: data.area };
        db.saveUsers(users);
        if (current.name !== data.name) {
          db.saveAssets(db.assets().map(a => (a.assignedTo && Utils.sameId(a.assignedTo.id, id) ? { ...a, assignedTo: { id: a.assignedTo.id, name: data.name } } : a)));
        }
        log('Modificó usuario: ' + data.name, 'info');
        return clone(users[i]);
      },

      async remove(id) {
        await wait();
        requirePermission('users.write');
        const users = db.users();
        const i = findIndex(users, id);
        if (i < 0) fail(404, 'El usuario ya no existe. Recargue la lista.', null, 'NOT_FOUND');
        const u = users[i];
        const admins = users.filter(x => x.role === 'Administrador' && x.status === 'active');
        if (u.role === 'Administrador' && admins.length <= 1) fail(409, 'No puede eliminar al último administrador.', null, 'LAST_ADMIN');
        if (Utils.sameId(u.id, Auth.getUser().id)) fail(409, 'No puede eliminar su propia cuenta.', null, 'SELF_DELETE');
        users.splice(i, 1);
        const assets = db.assets().map(a => (a.assignedTo && Utils.sameId(a.assignedTo.id, id) ? { ...a, assignedTo: null, status: 'Disponible' } : a));
        db.saveAssets(assets);
        db.saveUsers(users);
        log('Eliminó usuario: ' + u.name, 'danger');
        return null;
      },

      async setStatus(id, status) {
        await wait();
        requirePermission('users.write');
        if (!['active', 'disabled'].includes(status)) fail(422, 'Estado no válido.', null, 'VALIDATION_ERROR');
        const users = db.users();
        const i = findIndex(users, id);
        if (i < 0) fail(404, 'El usuario ya no existe. Recargue la lista.', null, 'NOT_FOUND');
        const u = users[i];
        if (status === 'disabled') {
          const admins = users.filter(x => x.role === 'Administrador' && x.status === 'active');
          if (u.role === 'Administrador' && admins.length <= 1) fail(409, 'No puede deshabilitar al último administrador.', null, 'LAST_ADMIN');
          if (Utils.sameId(u.id, Auth.getUser().id)) fail(409, 'No puede deshabilitar su propia cuenta.', null, 'SELF_DISABLE');
        }
        users[i] = { ...u, status };
        db.saveUsers(users);
        log((status === 'disabled' ? 'Deshabilitó' : 'Habilitó') + ' cuenta: ' + u.name, status === 'disabled' ? 'danger' : 'success');
        return clone(users[i]);
      },

      async backups(id) {
        await wait();
        requirePermission('users.view');
        const u = db.users().find(x => Utils.sameId(x.id, id));
        if (!u) fail(404, 'El usuario ya no existe.', null, 'NOT_FOUND');
        log('Consultó respaldos de ' + u.name, 'info');
        return MockData.backups();
      },
    },

    /* ═══ AUDITORÍA ═══ */
    audit: {
      async list({ type = null, limit = 50, offset = 0 } = {}) {
        await wait();
        requirePermission('audit.view');
        const all = db.audit();
        const filtered = type ? all.filter(e => e.type === type) : all;
        return { items: filtered.slice(offset, offset + limit), total: filtered.length, totalAll: all.length };
      },
      // Eventos que solo conoce el navegador (ej.: "Descargó instalador")
      async track({ message, type = 'info' }) {
        requireSession();
        return log(message, type);
      },
    },

    /* ═══ Solo mock: restablecer datos de demostración ═══ */
    reset() {
      [K.users, K.assets, K.audit, DATA_VERSION_KEY].forEach(k => Utils.remove(k));
      db.saveUsers(MockData.users());
      db.saveAssets(MockData.assets());
      Utils.store(DATA_VERSION_KEY, DATA_VERSION);
    },

    log,
  };
})();
