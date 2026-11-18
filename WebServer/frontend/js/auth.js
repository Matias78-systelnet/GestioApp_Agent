/* ═══ auth.js — Sesión, permisos y cierre por inactividad ═══
 * Guarda { token, user, loginTime, lastActivity } en sessionStorage (o localStorage
 * si CONFIG.auth.storage = 'local'). El usuario ({ id, name, email, role, area }) viene del backend.
 */

const Auth = {
  KEY: 'gestio_session',
  REMEMBER_KEY: 'gestio_remember_email',
  _timer: null,
  _listening: false,
  _lastWrite: 0,

  storage() {
    return CONFIG.auth.storage === 'local' ? localStorage : sessionStorage;
  },

  timeoutMs() {
    return CONFIG.auth.sessionTimeoutMin * 60 * 1000;
  },

  // ── Sesión actual (null si no hay o si expiró por inactividad) ──
  getSession() {
    const s = Utils.load(Auth.KEY, null, Auth.storage());
    if (!s || !s.user) return null;
    if (Auth.isExpired(s)) return null;
    return s;
  },

  isExpired(s) {
    return Date.now() - (s.lastActivity || 0) > Auth.timeoutMs();
  },

  isLoggedIn() { return !!Auth.getSession(); },
  getUser() { return Auth.getSession()?.user || null; },
  getToken() { return Auth.getSession()?.token || null; },

  // ── Permisos por rol (CONFIG.permissions). El backend debe validar lo mismo. ──
  can(permission) {
    const user = Auth.getUser();
    if (!user) return false;
    const perms = CONFIG.permissions[user.role] || [];
    return perms.includes('*') || perms.includes(permission);
  },

  canView(routeKey) {
    const r = ROUTES[routeKey];
    return !!r && (r.public || !r.permission || Auth.can(r.permission));
  },

  firstAllowedRoute() {
    return Object.keys(ROUTES).find(k => ROUTES[k].nav && Auth.canView(k)) || 'login';
  },

  // ── Login ── devuelve { ok, msg?, fieldErrors? }
  async login(email, password, remember = false) {
    const fieldErrors = {};
    if (!email) fieldErrors['login-email'] = 'Ingrese su email corporativo.';
    else if (!Validators.email(email).ok) fieldErrors['login-email'] = 'Use un email válido, por ejemplo nombre@empresa.cl.';
    if (!password) fieldErrors['login-password'] = 'Ingrese su contraseña.';
    else if (password.length < CONFIG.auth.minPasswordLength) fieldErrors['login-password'] = `La contraseña tiene al menos ${CONFIG.auth.minPasswordLength} caracteres.`;
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    try {
      const { token, user } = await Api.auth.login({ email, password });
      const now = Date.now();
      Utils.store(Auth.KEY, { token, user, loginTime: now, lastActivity: now }, Auth.storage());
      if (CONFIG.auth.rememberEmail) {
        if (remember) Utils.store(Auth.REMEMBER_KEY, email); else Utils.remove(Auth.REMEMBER_KEY);
      }
      Api.onSessionStart();
      Auth.startTimeout();
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: err.message || 'No se pudo iniciar sesión.' };
    }
  },

  rememberedEmail() {
    return CONFIG.auth.rememberEmail ? Utils.load(Auth.REMEMBER_KEY, '') : '';
  },

  // ── Logout ──
  async logout() {
    try { if (Auth.getToken()) await Api.auth.logout(); } catch { /* el servidor puede no responder: se cierra igual */ }
    Auth.clear();
  },

  clear() {
    Utils.remove(Auth.KEY, Auth.storage());
    clearInterval(Auth._timer);
    Auth._timer = null;
  },

  // Llamado por Http ante un 401 y por el control de inactividad
  handleUnauthorized(message = 'Su sesión expiró. Inicie sesión nuevamente.') {
    Auth.clear();
    const onPrivatePage = Router.current && !ROUTES[Router.current]?.public;
    if (onPrivatePage) {
      Ui.notify(message, 'warning');
      Router.go('login');
    }
  },

  // ── Inactividad ──
  touch() {
    const s = Utils.load(Auth.KEY, null, Auth.storage());
    if (!s) return;
    if (Auth.isExpired(s)) {
      Auth.handleUnauthorized(`Sesión cerrada tras ${CONFIG.auth.sessionTimeoutMin} minutos de inactividad.`);
      return;
    }
    const now = Date.now();
    if (now - Auth._lastWrite < 10000) return; // escribir como máximo cada 10 s
    Auth._lastWrite = now;
    s.lastActivity = now;
    Utils.store(Auth.KEY, s, Auth.storage());
  },

  startTimeout() {
    if (!Auth._listening) {
      ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, () => Auth.touch(), { passive: true });
      });
      Auth._listening = true;
    }
    clearInterval(Auth._timer);
    Auth._timer = setInterval(() => {
      const raw = Utils.load(Auth.KEY, null, Auth.storage());
      if (raw && Auth.isExpired(raw)) {
        Auth.handleUnauthorized(`Sesión cerrada tras ${CONFIG.auth.sessionTimeoutMin} minutos de inactividad.`);
      }
    }, 30000);
  },
};
