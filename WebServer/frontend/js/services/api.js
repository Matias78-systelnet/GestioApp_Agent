/* ═══ services/api.js — Punto único de acceso a datos ═══
 * Las pantallas SOLO usan `Api.*`. Nunca llaman a fetch ni a localStorage directamente.
 * CONFIG.api.mode decide el adaptador:
 *   'mock' → MockApi (localStorage, sin servidor)
 *   'http' → HttpApi (backend real en CONFIG.api.baseUrl)
 * Todas las funciones son async y, ante un error, lanzan ApiError.
 * Contrato completo (rutas, cuerpos y respuestas): docs/API.md
 */

const HttpApi = {
  auth: {
    login: ({ email, password }) => Http.call('login', {}, { email, password }),
    logout: () => Http.call('logout', {}, {}),
    me: () => Http.call('me'),
  },
  dashboard: {
    summary: () => Http.call('dashboardSummary'),
  },
  assets: {
    list: (query) => Http.call('assetsList', {}, undefined, query),
    create: (data) => Http.call('assetsCreate', {}, data),
    renewCode: (id) => Http.call('assetEnrollmentCode', { id }, {}),
    update: (id, data) => Http.call('assetsUpdate', { id }, data),
    remove: (id) => Http.call('assetsDelete', { id }),
    assign: (id, userId) => Http.call('assetsAssign', { id }, { userId: userId === '' ? null : userId }),
  },
  users: {
    list: (query) => Http.call('usersList', {}, undefined, query),
    create: (data) => Http.call('usersCreate', {}, data),
    update: (id, data) => Http.call('usersUpdate', { id }, data),
    remove: (id) => Http.call('usersDelete', { id }),
    setStatus: (id, status) => Http.call('usersStatus', { id }, { status }),
    backups: (id) => Http.call('usersBackups', { id }),
  },
  audit: {
    list: ({ type, limit, offset } = {}) => Http.call('auditList', {}, undefined, { type, limit, offset }),
    track: ({ message, type = 'info' }) => Http.call('auditTrack', {}, { message, type }),
  },
};

const Api = (() => {
  const mode = CONFIG.api.mode === 'http' ? 'http' : 'mock';
  const adapter = mode === 'http' ? HttpApi : MockApi;

  return {
    mode,
    auth: adapter.auth,
    dashboard: adapter.dashboard,
    assets: adapter.assets,
    users: adapter.users,
    audit: adapter.audit,

    // En modo http el servidor registra el login; en mock se simula aquí.
    onSessionStart() {
      if (mode === 'mock') MockApi.log('Inició sesión en el panel', 'info');
    },

    // Registrar un evento del navegador sin interrumpir al usuario si falla.
    async track(message, type = 'info') {
      try { await adapter.audit.track({ message, type }); } catch (e) { console.warn('[Api.track]', e); }
    },

    resetDemoData() {
      if (mode === 'mock') MockApi.reset();
    },
  };
})();
