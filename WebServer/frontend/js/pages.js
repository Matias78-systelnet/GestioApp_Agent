/* ═══ pages.js — Landing, Login, Dashboard y registro de páginas ═══
 * Cada página es un objeto con template() (HTML) e init() (carga de datos, puede ser async).
 * Para agregar una página: crear el módulo, sumarlo a Pages y a ROUTES en config.js.
 */

// ══════════════════════════════════
//  LANDING (pública)
// ══════════════════════════════════
const Landing = {
  template() {
    const features = [
      { icon: 'bi-boxes', title: 'Inventario completo', text: 'Equipos, mobiliario, vehículos y herramientas. Cada activo trazable con número de serie, valor y ubicación.' },
      { icon: 'bi-people', title: 'Gestión de usuarios', text: 'Cuentas por persona con roles por área. Deshabilite accesos al instante desde el panel.' },
      { icon: 'bi-shield-check', title: 'Seguridad integrada', text: 'VPN con doble factor, políticas GPO y auditoría de cada acción. Cumplimiento normativo incluido.' },
    ];
    const stats = [['99.9%', 'Uptime garantizado'], ['< 5 min', 'Onboarding por usuario'], ['Multi-sede', 'Casa matriz + sucursales']];

    return `
    <div class="app-shell">
      ${Components.topBar()}
      <header class="navbar-g" id="navbar">
        <div class="container-xl d-flex align-items-center justify-content-between navbar-row">
          <a href="#/landing" data-go="landing" class="brand-link" aria-label="${Utils.esc(CONFIG.app.name)}, inicio">${Components.logo()}</a>
          <a href="#/login" data-go="login" class="btn btn-brand">Iniciar sesión ${Components.icon('bi-arrow-right')}</a>
        </div>
      </header>

      <main id="main" tabindex="-1">
        <section class="hero-g hero-main" data-bg="landing" aria-labelledby="landing-title">
          <div class="hero-grid" aria-hidden="true"></div>
          <div class="container-xl position-relative stagger">
            <p class="eyebrow-g reveal"><span aria-hidden="true"></span>Plataforma de gestión para PyMEs chilenas</p>
            <h1 class="hero-title reveal" id="landing-title">Control total de activos <em>en un solo lugar</em></h1>
            <p class="hero-sub reveal">Inventario de equipos, gestión de accesos y auditoría centralizada. Diseñado para empresas con múltiples sedes.</p>
            <div class="hero-ctas reveal">
              <a href="#/login" data-go="login" class="btn btn-brand btn-lg">Entrar al panel ${Components.icon('bi-arrow-right')}</a>
              <button type="button" class="btn btn-ghost-light btn-lg" data-action="scroll-to" data-target="features">Ver funcionalidades</button>
            </div>
          </div>
        </section>

        <section class="container-xl float-row" id="features" aria-labelledby="features-title">
          <h2 class="visually-hidden" id="features-title">Funcionalidades</h2>
          <ul class="row g-4 stagger list-unstyled">
            ${features.map(f => `
            <li class="col-md-4 reveal">
              <article class="float-card">
                <span class="float-accent" aria-hidden="true"></span>
                <span class="float-icon">${Components.icon(f.icon)}</span>
                <h3>${f.title}</h3>
                <p class="float-text">${f.text}</p>
              </article>
            </li>`).join('')}
          </ul>
        </section>

        <section class="container-xl py-5 my-3" aria-label="Cifras">
          <ul class="row g-4 stagger list-unstyled">
            ${stats.map(([v, l]) => `<li class="col-sm-4 reveal"><div class="landing-stat"><strong class="mono">${Utils.esc(v)}</strong><span>${l}</span></div></li>`).join('')}
          </ul>
        </section>

        <section class="cta-band" aria-labelledby="cta-title">
          <div class="container-xl d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4">
            <div>
              <h2 id="cta-title">Empiece a controlar sus activos hoy</h2>
              <p>Configuración en menos de 10 minutos. Soporte incluido.</p>
            </div>
            <a href="#/login" data-go="login" class="btn btn-brand btn-lg">Iniciar sesión ${Components.icon('bi-arrow-right')}</a>
          </div>
        </section>
      </main>
      <footer class="footer-g footer-dark">
        <div class="container-xl d-flex flex-column flex-sm-row gap-3 justify-content-between align-items-sm-center">
          ${Components.logo()}
          <span>© ${new Date().getFullYear()} ${Utils.esc(CONFIG.app.company)} — ${Utils.esc(CONFIG.app.country)}</span>
        </div>
      </footer>
    </div>`;
  },
  init() {},
};

// ══════════════════════════════════
//  LOGIN (pública)
// ══════════════════════════════════
const Login = {
  template() {
    const remembered = Auth.rememberedEmail();
    return `
    <div class="login-g">
      <aside class="login-side hero-g" data-bg="login" aria-hidden="true">
        <div class="hero-grid"></div>
        <div class="position-relative">${Components.logo()}</div>
        <div class="position-relative stagger">
          <p class="hero-title-sm reveal">Gestione sus activos <em class="d-block">con confianza</em></p>
          <p class="hero-sub reveal">Panel centralizado para inventario, usuarios y seguridad. Todo en tiempo real.</p>
          <ul class="login-checks">
            <li class="reveal"><span>${Components.icon('bi-buildings')}</span> Inventario multi-sede en tiempo real</li>
            <li class="reveal"><span>${Components.icon('bi-journal-check')}</span> Auditoría completa de accesos</li>
            <li class="reveal"><span>${Components.icon('bi-shield-lock')}</span> VPN con doble factor integrada</li>
          </ul>
        </div>
        <small class="position-relative login-copy">© ${new Date().getFullYear()} ${Utils.esc(CONFIG.app.company)} — ${Utils.esc(CONFIG.app.country)}</small>
      </aside>

      <main class="login-main" id="main" tabindex="-1">
        <form class="login-card reveal" data-submit="login" novalidate aria-labelledby="login-title">
          <div class="d-lg-none mb-4">${Components.logo(true)}</div>
          <h1 id="login-title">Bienvenido</h1>
          <p class="text-secondary mb-0">Ingrese sus credenciales para continuar.</p>
          <div id="login-error" class="alert-g" role="alert" hidden></div>
          <div class="mt-4">
            ${Components.field({ id: 'login-email', name: 'email', label: 'Email corporativo', type: 'email', placeholder: 'nombre@empresa.cl', required: true, autocomplete: 'username', value: remembered })}
            ${Components.field({ id: 'login-password', name: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••', required: true, autocomplete: 'current-password' })}
          </div>
          <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center small">
            ${CONFIG.auth.rememberEmail ? `
            <div class="form-check m-0">
              <input type="checkbox" class="form-check-input check-g" id="login-remember" name="remember" ${remembered ? 'checked' : ''}>
              <label class="form-check-label text-secondary" for="login-remember">Recordar mi email</label>
            </div>` : '<span></span>'}
            <a href="${Utils.esc(Utils.safeUrl(CONFIG.auth.passwordResetUrl))}" class="link-brand">¿Olvidó su contraseña?</a>
          </div>
          <button type="submit" class="btn btn-brand btn-lg w-100 mt-4" id="btn-login" data-busy-label="Ingresando…">${Components.icon('bi-box-arrow-in-right')} Iniciar sesión</button>
          ${Api.mode === 'mock' ? `<p class="demo-hint">Modo demostración: <span class="mono">${Utils.esc(CONFIG.mock.admin.email)}</span> / <span class="mono">${Utils.esc(CONFIG.mock.admin.password)}</span></p>` : ''}
          <p class="text-center mt-3 mb-0">
            <a href="#/landing" data-go="landing" class="link-muted-g">${Components.icon('bi-arrow-left')} Volver al inicio</a>
          </p>
        </form>
      </main>
    </div>`;
  },

  init() {},

  async submit(form) {
    const data = Ui.form.read(form);
    const errorBox = document.getElementById('login-error');
    errorBox.hidden = true;
    Ui.form.clearErrors(form);

    const result = await Ui.busy(document.getElementById('btn-login'), () => Auth.login(data.email, data.password, data.remember));
    if (!result) return;
    if (result.ok) {
      Router.go(Auth.firstAllowedRoute());
      return;
    }
    if (result.fieldErrors) { Ui.form.setErrors(form, result.fieldErrors); return; }
    errorBox.textContent = result.msg;
    errorBox.hidden = false;
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  },
};

// ══════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════
const Dashboard = {
  template() {
    const user = Auth.getUser();
    const firstName = String(user?.name || '').split(' ')[0];
    return `
    <section class="hero-g hero-main" data-bg="dashboard" aria-labelledby="page-title">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="container-xl position-relative stagger">
        <p class="status-pill reveal"><span class="live-dot green" aria-hidden="true"></span><span>Hola ${Utils.esc(firstName)}, todos los sistemas operativos</span></p>
        <h1 class="hero-title reveal" id="page-title" tabindex="-1">Gestione sus activos <em>con total confianza</em></h1>
        <p class="hero-sub reveal">Panel centralizado para inventario multi-sede, control de usuarios y seguridad con VPN y doble factor en tiempo real.</p>
        <div class="hero-ctas reveal">
          ${Auth.canView('activos') ? `<a href="#/activos" data-go="activos" class="btn btn-brand btn-lg">Ver inventario ${Components.icon('bi-arrow-right')}</a>` : ''}
          ${Auth.canView('auditoria') ? `<a href="#/auditoria" data-go="auditoria" class="btn btn-ghost-light btn-lg">${Components.icon('bi-journal-text')} Ver documentación / auditoría</a>` : ''}
        </div>
      </div>
    </section>

    <div id="dash-content" aria-busy="true">
      <div class="container-xl float-row">
        <div class="state-g state-dark" role="status"><span class="spinner-border text-brand" aria-hidden="true"></span><p>Cargando resumen…</p></div>
      </div>
    </div>`;
  },

  async init(track = true) {
    const container = document.getElementById('dash-content');
    try {
      if (track && CONFIG.features.logDashboardVisits) Api.track('Accedió al Dashboard', 'info');   // sin await: no retrasa la carga
      const s = await Api.dashboard.summary();
      if (!document.body.contains(container)) return; // el usuario ya navegó a otra página
      container.innerHTML = Dashboard.content(s);
      container.removeAttribute('aria-busy');
      Components.applyBackgrounds(container);
      Ui.animateIn(container);
    } catch (err) {
      container.innerHTML = '<div class="container-xl float-row"><div class="panel-g" id="dash-error"></div></div>';
      Ui.errorState(document.getElementById('dash-error'), err, 'dash-reload');
    }
  },

  content(s) {
    const A = s.assets;
    const U = s.users;
    const last = s.audit.latest;
    const byType = CONFIG.catalogs.assetTypes.map(t => ({ ...t, count: (A.byType || {})[t.value] || 0 }));
    const link = (route, text) => (Auth.canView(route)
      ? `<a href="#/${route}" data-go="${route}" class="float-btn">${text} ${Components.icon('bi-arrow-up-right')}</a>` : '');

    const floatCard = (icon, eyebrow, title, body, cta) => `
      <li class="col-md-4 reveal">
        <article class="float-card">
          <span class="float-accent" aria-hidden="true"></span>
          <div class="d-flex justify-content-between align-items-start">
            <span class="float-icon">${Components.icon(icon)}</span>
            <span class="float-eyebrow">${eyebrow}</span>
          </div>
          <h3>${title}</h3>
          <div class="float-text">${body}</div>
          ${cta}
        </article>
      </li>`;

    const bar = (icon, label, count, value, fill) => `
      <div class="bar-row">
        <div class="bar-head">
          <span>${Components.icon(icon)} ${Utils.esc(label)}</span>
          <span class="mono"><strong>${count}</strong> · ${value}%</span>
        </div>
        <div class="bar-track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-label="${Utils.esc(label)}: ${count} de ${A.total}">
          <div class="bar-fill ${fill}" data-value="${value}"></div>
        </div>
      </div>`;

    const fa = s.featuredAsset;
    // Si el activo destacado tiene ficha técnica, se muestra como Hardware Asset Card
    const featured = fa && fa.specs ? Components.hardwareCard(fa, {
      uid: 'dash',
      actions: Auth.canView('activos') ? `<a href="#/activos" data-go="activos" class="btn btn-brand btn-sm">Gestionar<span class="visually-hidden"> activos</span> ${Components.icon('bi-arrow-right')}</a>` : '',
    }) : fa ? (() => {
      const assigned = !!fa.assignedTo;
      return `
      <article class="featured-g" aria-labelledby="featured-title">
        <div class="featured-img">
          <img src="${Utils.esc(CONFIG.images.laptop)}" alt="" loading="lazy" data-hide-on-error>
          <div class="featured-badges">
            ${Components.badge('Activo destacado', 'dark')}
            ${Components.badge(fa.status, assigned ? 'pri' : 'grn', true)}
          </div>
        </div>
        <div class="featured-body">
          <p class="kicker-g">${Utils.esc(Utils.assetType(fa.type).label)}</p>
          <h3 id="featured-title">${Utils.esc(fa.name)}</h3>
          <dl class="spec-grid">
            <div class="spec wide"><dt>${Components.icon('bi-hash')} N° de serie</dt><dd class="mono">${Utils.esc(fa.serial)}</dd></div>
            <div class="spec"><dt>${Components.icon('bi-geo-alt')} Ubicación</dt><dd>${Utils.esc(fa.location)}</dd></div>
            <div class="spec"><dt>${Components.icon('bi-wallet2')} Valor</dt><dd class="mono">${Utils.esc(Utils.formatMoney(fa.value))}</dd></div>
          </dl>
          <div class="featured-foot">
            <div class="d-flex align-items-center gap-2">
              <span class="avatar-g brand" aria-hidden="true">${assigned ? Utils.esc(Utils.initials(fa.assignedTo.name)) : Components.icon('bi-person')}</span>
              <p class="lh-sm m-0"><small>Asignado a</small><strong class="d-block">${assigned ? Utils.esc(fa.assignedTo.name) : 'Sin asignar'}</strong></p>
            </div>
            ${Auth.canView('activos') ? `<a href="#/activos" data-go="activos" class="btn btn-brand">Gestionar<span class="visually-hidden"> activos</span> ${Components.icon('bi-arrow-right')}</a>` : ''}
          </div>
        </div>
      </article>`;
    })() : `<div class="card-g h-100 text-center d-grid align-content-center"><h3 class="h6 fw-bold">Aún no hay activos</h3><p class="text-secondary small">Registre el primer equipo para verlo destacado aquí.</p></div>`;

    const activity = s.recentActivity || [];

    return `
    <div class="container-xl float-row">
      <h2 class="visually-hidden">Accesos rápidos</h2>
      <ul class="row g-4 stagger list-unstyled">
        ${floatCard('bi-buildings', `${A.locations.length} sedes`, 'Inventario multi-sede',
          `<p><strong class="mono big-num">${A.available}</strong> / ${A.total} equipos disponibles para asignar.</p>
           <ul class="d-flex flex-wrap gap-1 list-unstyled m-0" aria-label="Sedes">${A.locations.map(l => `<li class="chip-g">${Utils.esc(l)}</li>`).join('')}</ul>`,
          link('activos', 'Abrir inventario'))}
        ${floatCard('bi-journal-text', 'En vivo', 'Auditoría de accesos',
          `<p class="d-flex align-items-center gap-2"><span class="live-dot" aria-hidden="true"></span><span><strong class="mono">${s.audit.total}</strong> ${s.audit.total === 1 ? 'evento registrado' : 'eventos registrados'}</span></p>
           <p class="last-log">${last ? `<time class="mono" datetime="${Utils.esc(last.timestamp)}">${Utils.esc(Utils.formatTime(last.timestamp, true))}</time> · ${Utils.esc(last.message)}` : 'Sin eventos todavía.'}</p>`,
          link('auditoria', 'Revisar registros'))}
        ${floatCard('bi-shield-check', 'Protegido', 'VPN con doble factor',
          `<p>FortiClient VPN + Google Authenticator activos para todas las cuentas habilitadas.</p>
           <p class="d-flex align-items-center gap-2 m-0">
             <span class="shield-stack" aria-hidden="true">${'<i></i>'.repeat(Math.min(U.withTwoFactor, 5))}</span>
             <span class="text-success-g fw-semibold small">${U.withTwoFactor} cuentas con 2FA</span>
           </p>`,
          link('descargas', 'Ver guía de conexión'))}
      </ul>
    </div>

    <div class="container-xl dash-body">
      <section aria-labelledby="kpi-title">
        ${Components.sectionHeader('Estadísticas clave', 'Resumen operativo', 'kpi-title')}
        <ul class="row g-3 stagger list-unstyled" id="dashboard-stats">
          ${Components.statCard('Total activos', A.total, 'bi-box-seam', 'brand', Components.badge('Inventario', 'pri', true))}
          ${Components.statCard('Asignados', A.assigned, 'bi-link-45deg', 'brand', Components.badge('En uso'))}
          ${Components.statCard('Disponibles', A.available, 'bi-check2-circle', 'green', Components.badge('Libres', 'grn'))}
          ${Components.statCard('Usuarios activos', U.active, 'bi-person-check', 'brand', Components.badge('Cuentas'))}
          ${Components.statCard('Deshabilitados', U.disabled, 'bi-person-x', 'red', U.disabled ? Components.badge('Revisar', 'red') : Components.badge('Sin alertas'), U.disabled > 0)}
        </ul>
      </section>

      <div class="row g-4 mt-4 stagger">
        <section class="col-lg-6 reveal" aria-labelledby="dist-title">
          <div class="card-g h-100">
            <p class="kicker-g">Inventario</p>
            <h2 class="card-title-g" id="dist-title">Distribución por tipo</h2>
            ${byType.map((t, i) => bar(t.icon, t.label, t.count, Utils.pct(t.count, A.total), i === 0 ? 'fill-brand' : 'fill-dark')).join('')}
          </div>
        </section>
        <section class="col-lg-6 reveal" aria-labelledby="status-title">
          <div class="card-g h-100">
            <p class="kicker-g">Operación</p>
            <h2 class="card-title-g" id="status-title">Estado de activos</h2>
            ${bar('bi-link-45deg', 'Asignados', A.assigned, Utils.pct(A.assigned, A.total), 'fill-brand')}
            ${bar('bi-check2-circle', 'Disponibles', A.available, Utils.pct(A.available, A.total), 'fill-green')}
          </div>
        </section>
      </div>

      <div class="row g-4 mt-4 stagger">
        <section class="col-lg-5 reveal" aria-label="Activo destacado">${featured}</section>
        <section class="col-lg-7 reveal" aria-labelledby="activity-title">
          <div class="card-g h-100">
            <div class="d-flex justify-content-between align-items-end mb-3 gap-2">
              <div>
                <p class="kicker-g">Registro</p>
                <h2 class="card-title-g mb-0" id="activity-title">Actividad reciente</h2>
              </div>
              ${Auth.canView('auditoria') ? `<a href="#/auditoria" data-go="auditoria" class="link-brand link-arrow">Ver todo<span class="visually-hidden"> el registro de auditoría</span> ${Components.icon('bi-arrow-right')}</a>` : ''}
            </div>
            ${activity.length ? `<ol class="timeline-g">${activity.map(e => `
              <li class="tl-item">
                <time class="tl-time mono" datetime="${Utils.esc(e.timestamp)}"><small>${Utils.esc(Utils.formatDate(e.timestamp).slice(0, 5))}</small>${Utils.esc(Utils.formatTime(e.timestamp))}</time>
                <span class="tl-icon">${Components.icon(AuditPage.icon(e))}<i class="tl-dot t-${Utils.esc(e.type)}" aria-hidden="true"></i></span>
                <span class="tl-text">${Utils.esc(e.message)}</span>
              </li>`).join('')}</ol>`
              : Components.empty('Sin actividad todavía. Registre o asigne un activo y aparecerá aquí.')}
          </div>
        </section>
      </div>
    </div>`;
  },
};

Actions.register({
  'login': (form) => Login.submit(form),
  'dash-reload': () => Dashboard.init(false),
});

// Imágenes decorativas que no cargan: se ocultan (sin onerror en línea)
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-hide-on-error')) e.target.remove();
}, true);

// ══════════════════════════════════
//  REGISTRO DE PÁGINAS (clave = ruta)
// ══════════════════════════════════
const Pages = {
  landing: Landing,
  login: Login,
  dashboard: Dashboard,
  activos: Assets,
  usuarios: Users,
  auditoria: AuditPage,
  descargas: Downloads,
  configuracion: Settings,
};
