/* ═══ config.js — Configuración central de GestioApp ═══
 *
 * Este es el ÚNICO archivo que hay que tocar para adaptar el frontend a un entorno.
 * Para no editarlo por entorno, defina window.GESTIO_CONFIG en app.html ANTES de
 * cargar este script; se mezcla en profundidad sobre DEFAULT_CONFIG. Ejemplo:
 *
 *   <script>
 *     window.GESTIO_CONFIG = { api: { mode: 'http', baseUrl: 'https://api.empresa.cl/v1' } };
 *   </script>
 *
 * Ver README.md → "Configuración" y docs/API.md para el contrato con el backend.
 */

const DEFAULT_CONFIG = {
  app: {
    name: 'GestioApp',
    version: '2.1.0',
    locale: 'es-CL',
    currency: 'CLP',
    company: 'GestioApp SpA',
    country: 'Chile',
  },

  // ── Conexión con el backend ──
  api: {
    // 'mock' → datos locales en localStorage (desarrollo / demo, sin servidor)
    // 'http' → llamadas reales al backend definido en baseUrl
    mode: 'mock',
    baseUrl: '/api/v1',
    timeoutMs: 15000,
    // true → envía cookies (sesión por cookie HttpOnly). false → usa token Bearer.
    withCredentials: false,
    // "MÉTODO /ruta". Los parámetros :id se reemplazan automáticamente.
    endpoints: {
      login: 'POST /auth/login',
      logout: 'POST /auth/logout',
      me: 'GET /auth/me',
      dashboardSummary: 'GET /dashboard/summary',
      assetsList: 'GET /assets',
      assetsCreate: 'POST /assets',
      assetEnrollmentCode: 'POST /assets/:id/enrollment-code',
      assetsUpdate: 'PUT /assets/:id',
      assetsDelete: 'DELETE /assets/:id',
      assetsAssign: 'PUT /assets/:id/assignment',
      usersList: 'GET /users',
      usersCreate: 'POST /users',
      usersUpdate: 'PUT /users/:id',
      usersDelete: 'DELETE /users/:id',
      usersStatus: 'PATCH /users/:id/status',
      usersBackups: 'GET /users/:id/backups',
      auditList: 'GET /audit',
      auditTrack: 'POST /audit/events',
    },
  },

  // ── Sesión ──
  auth: {
    sessionTimeoutMin: 30,          // cierre por inactividad
    storage: 'session',             // 'session' (se borra al cerrar la pestaña) | 'local'
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer ',
    minPasswordLength: 8,
    rememberEmail: true,            // muestra "Recordar mi email" en el login
    passwordResetUrl: 'mailto:soporte@gestioapp.cl?subject=Recuperar%20clave',
  },

  // ── Solo para api.mode = 'mock' ──
  mock: {
    latencyMs: 250,                 // simula la demora de red
    admin: { email: 'admin@empresa.cl', password: 'admin123' },
    demoPassword: 'demo1234',       // clave de los demás usuarios semilla (para probar roles)
    storageKeys: {
      users: 'gestio_users',
      assets: 'gestio_assets',
      audit: 'gestio_audit',
    },
  },

  support: {
    email: 'soporte@gestioapp.cl',
    phone: '+56 2 2345 6789',
    faqRoute: 'descargas',
  },

  // ── Catálogos (deben coincidir con los valores que acepte el backend) ──
  catalogs: {
    locations: ['Casa Matriz', 'Edificio Central', 'Sucursal 2', 'Sucursal 3', 'Bodega', 'Faena'],
    roles: ['Usuario', 'Supervisor', 'Administrador'],
    areas: ['RRHH', 'Contabilidad', 'Operaciones', 'Informática', 'Soporte TI', 'Gerencia'],
    // Condición operativa del equipo (independiente de si está asignado o disponible)
    assetConditions: [
      { value: 'Operativo', badge: 'grn' },
      { value: 'En reparación', badge: 'ylw' },
      { value: 'De baja', badge: 'red' },
    ],
    assetTypes: [
      { value: 'Notebook', label: 'Notebook', icon: 'bi-laptop' },
      { value: 'PC', label: 'PC Desktop', icon: 'bi-pc-display' },
    ],
    auditTypes: {
      success: { label: 'Creación', badge: 'grn' },
      info: { label: 'Modificación', badge: 'pri' },
      danger: { label: 'Eliminación', badge: 'red' },
      warn: { label: 'Advertencia', badge: 'ylw' },
    },
  },

  // ── Permisos por rol ('*' = todo). El backend DEBE validar lo mismo. ──
  permissions: {
    Administrador: ['*'],
    Supervisor: [
      'dashboard.view', 'assets.view', 'assets.write', 'assets.assign',
      'users.view', 'audit.view', 'downloads.view', 'settings.view',
    ],
    Usuario: ['dashboard.view', 'downloads.view', 'settings.view'],
  },

  features: {
    logDashboardVisits: true,       // registra "Accedió al Dashboard" en auditoría
    csvExport: true,
    csvSeparator: ';',              // ';' para Excel con configuración regional Chile
    featuredAssetSerial: '8X9K2Z3',   // Dell Latitude 5440: se muestra como Hardware Asset Card en el dashboard
    timelineSize: 7,                // eventos en el Dashboard
    auditPageSize: 50,              // registros por página en Auditoría
  },

  downloads: {
    installerName: 'GestioApp-Setup.exe',
    installerUrl: '',               // URL real del instalador. Vacío = descarga simulada
    installerMeta: 'Windows 10/11 · 45 MB · Incluye Agent + FortiClient + Google Auth',
    components: [
      { icon: 'bi-broadcast', name: 'GestioApp Agent', version: 'v1.0.0', description: 'Monitoreo e inventario en segundo plano.' },
      { icon: 'bi-shield-lock', name: 'FortiClient VPN', version: 'v7.4.1', description: 'Túnel cifrado a la red corporativa.' },
      { icon: 'bi-key', name: 'Google Auth', version: 'v1.2.0', description: 'Doble factor de autenticación.' },
    ],
    steps: [
      { title: 'Descargar instalador', icon: 'bi-download', description: 'Descargue GestioApp-Setup.exe (~45 MB). Incluye GestioApp Agent, FortiClient VPN y Google Auth Config.', detail: 'Instalador unificado que detecta su versión de Windows automáticamente.' },
      { title: 'Ejecutar instalador', icon: 'bi-window-desktop', description: 'Doble clic en el archivo. Si aparece un aviso de Windows: "Más información" → "Ejecutar de todas formas".', detail: 'Necesita permisos de administrador. La instalación toma ~3 minutos.' },
      { title: 'Seleccionar componentes', icon: 'bi-boxes', description: 'Se instalan 3 componentes: GestioApp Agent, FortiClient VPN y Google Auth Config.', detail: 'Agent: monitoreo. FortiClient: VPN cifrada. Auth: códigos 2FA del celular.' },
      { title: 'Configurar cuenta', icon: 'bi-key', description: 'Ingrese el usuario y contraseña que le entregó su administrador.', detail: 'Use exactamente las credenciales que recibió.' },
      { title: 'Activar 2FA', icon: 'bi-qr-code-scan', description: 'Escanee el código QR con Google Authenticator en su celular. Ingrese el código de 6 dígitos.', detail: 'El QR se muestra una sola vez. El código cambia cada 30 segundos.' },
      { title: 'Conectar VPN', icon: 'bi-shield-lock', description: 'En FortiClient escriba su clave + código del celular, todo junto. Ejemplo: MiClave123!482910', detail: 'Primero su contraseña normal y, pegado al final, el código de 6 dígitos.' },
      { title: 'Listo', icon: 'bi-patch-check', description: 'VPN conectada, Agent reportando y políticas aplicadas correctamente.', detail: 'La VPN se reconecta sola. El Agent se inicia con Windows.' },
    ],
  },

  // Fotografías de fondo. Para producción conviene alojarlas en el mismo servidor.
  // Si no cargan, se ve el degradado oscuro de respaldo.
  // Cada sección del menú tiene su propia foto de oficina (Unsplash, licencia libre).
  images: {
    // Por sección
    landing:       'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=2000&q=70',
    login:         'https://images.unsplash.com/photo-1522071901873-411886a10004?auto=format&fit=crop&w=2000&q=70',
    dashboard:     'https://images.unsplash.com/photo-1758762641372-e3b52bf061d4?auto=format&fit=crop&w=2000&q=70',
    activos:       'https://images.unsplash.com/photo-1560264280-88b68371db39?auto=format&fit=crop&w=2000&q=70',
    usuarios:      'https://images.unsplash.com/photo-1748256467077-c75ef01579aa?auto=format&fit=crop&w=2000&q=70',
    auditoria:     'https://images.unsplash.com/photo-1622675363311-3e1904dc1885?auto=format&fit=crop&w=2000&q=70',
    descargas:     'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&w=2000&q=70',
    configuracion: 'https://images.unsplash.com/photo-1577412647305-991150c7d163?auto=format&fit=crop&w=2000&q=70',
    // Genéricas (se mantienen por compatibilidad)
    datacenter: 'https://images.unsplash.com/photo-1677078610072-7f11ebc4d4d7?auto=format&fit=crop&w=2000&q=70',
    racks: 'https://images.unsplash.com/photo-1632835298280-ad3d64834ab8?auto=format&fit=crop&w=2000&q=70',
    office: 'https://images.unsplash.com/photo-1748256622734-92241ae7b43f?auto=format&fit=crop&w=2000&q=70',
    // Foto real del notebook (recorte del video promocional) para la Hardware Asset Card. Vacío = ilustración SVG
    notebookPhoto: 'img/notebook-real.webp',
    laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=70',
  },
};

/* ── Mezcla profunda: los objetos se combinan; arrays y valores simples se reemplazan ── */
function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(override).forEach((key) => {
    const b = base ? base[key] : undefined;
    const o = override[key];
    out[key] = (b && typeof b === 'object' && !Array.isArray(b) && o && typeof o === 'object' && !Array.isArray(o))
      ? deepMerge(b, o)
      : o;
  });
  return out;
}

const CONFIG = deepMerge(DEFAULT_CONFIG, window.GESTIO_CONFIG || {});

/* ── Rutas de la SPA. permission = permiso requerido (ver CONFIG.permissions) ── */
const ROUTES = {
  landing: { title: 'Inicio', public: true },
  login: { title: 'Iniciar sesión', public: true },
  dashboard: { title: 'Dashboard', icon: 'bi-speedometer2', permission: 'dashboard.view', nav: true },
  activos: { title: 'Activos', icon: 'bi-box-seam', permission: 'assets.view', nav: true },
  usuarios: { title: 'Usuarios', icon: 'bi-people', permission: 'users.view', nav: true },
  auditoria: { title: 'Auditoría', icon: 'bi-journal-text', permission: 'audit.view', nav: true },
  descargas: { title: 'Descargas', icon: 'bi-download', permission: 'downloads.view', nav: true },
  configuracion: { title: 'Configuración', icon: 'bi-gear', permission: 'settings.view', nav: true },
};
