/* ═══ components.js — Plantillas HTML reutilizables ═══
 * Reglas:
 *  - Todo texto que venga de datos pasa por Utils.esc().
 *  - Nada de onclick: usar data-go / data-action (ver actions.js).
 *  - Íconos decorativos con aria-hidden (usar Components.icon()).
 */

const Components = {

  icon(name, cls = '') {
    return `<i class="bi ${name}${cls ? ' ' + cls : ''}" aria-hidden="true"></i>`;
  },

  // ── Logo ──
  logo(dark = false) {
    return `
    <span class="logo-g ${dark ? 'logo-dark' : ''}">
      <span class="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" focusable="false"><path d="M19 7.5A8 8 0 1 0 20 13h-7"/></svg>
        <span class="logo-dot"></span>
      </span>
      <span class="logo-word">Gestio<span>App</span></span>
    </span>`;
  },

  // ── Barra naranja de soporte ──
  topBar() {
    const s = CONFIG.support;
    const tel = s.phone.replace(/\s/g, '');
    return `
    <div class="topbar-g">
      <div class="container-xl d-flex justify-content-between align-items-center gap-3">
        <nav class="d-flex gap-3 gap-sm-4" aria-label="Ayuda">
          <a href="mailto:${Utils.esc(s.email)}?subject=Soporte%20GestioApp">${Components.icon('bi-life-preserver')} Soporte</a>
          <a href="#/${s.faqRoute}" data-go="${s.faqRoute}">${Components.icon('bi-question-circle')} FAQs</a>
        </nav>
        <div class="d-flex gap-3 gap-sm-4">
          <a href="mailto:${Utils.esc(s.email)}" class="d-none d-sm-inline-flex">${Components.icon('bi-envelope')} ${Utils.esc(s.email)}</a>
          <a href="tel:${Utils.esc(tel)}" aria-label="Llamar a soporte: ${Utils.esc(s.phone)}">${Components.icon('bi-telephone')} <span class="mono">${Utils.esc(s.phone)}</span></a>
        </div>
      </div>
    </div>`;
  },

  // ── Layout de la app autenticada ──
  appLayout(activePage) {
    const user = Auth.getUser() || { name: 'Usuario', role: '', email: '' };
    const items = Object.keys(ROUTES).filter(k => ROUTES[k].nav && Auth.canView(k));
    const current = k => (k === activePage ? ' aria-current="page"' : '');
    const helpHref = `mailto:${Utils.esc(CONFIG.support.email)}?subject=Solicitud%20de%20asistencia%20GestioApp`;

    return `
    <div class="app-shell">
      ${Components.topBar()}
      <header class="navbar-g" id="navbar">
        <div class="container-xl d-flex align-items-center justify-content-between gap-3 navbar-row">
          <a href="#/${Auth.firstAllowedRoute()}" data-go="${Auth.firstAllowedRoute()}" class="brand-link" aria-label="${Utils.esc(CONFIG.app.name)}, ir al inicio">${Components.logo()}</a>

          <nav class="d-none d-lg-block" aria-label="Principal">
            <ul class="nav-list-g">
              ${items.map(k => `<li><a href="#/${k}" data-go="${k}" class="nav-g${k === activePage ? ' active' : ''}"${current(k)}>${ROUTES[k].title}</a></li>`).join('')}
            </ul>
          </nav>

          <div class="d-flex align-items-center gap-2 gap-sm-3">
            <a href="${helpHref}" class="btn btn-brand d-none d-xl-inline-flex">${Components.icon('bi-headset')} Solicitar asistencia</a>
            <div class="profile-g" id="profile">
              <button type="button" class="profile-btn" data-action="toggle-profile" aria-expanded="false" aria-controls="profile-menu">
                <span class="avatar-g" aria-hidden="true">${Utils.esc(Utils.initials(user.name))}<span class="avatar-status"></span></span>
                <span class="profile-text d-none d-xl-block">
                  <strong>${Utils.esc(user.name)}</strong>
                  <small>${Utils.esc(user.role)}</small>
                </span>
                <span class="visually-hidden d-xl-none">Menú de ${Utils.esc(user.name)}</span>
                ${Components.icon('bi-chevron-down', 'd-none d-xl-block')}
              </button>
              <div class="profile-menu" id="profile-menu" hidden>
                <div class="profile-head">
                  <strong>${Utils.esc(user.name)}</strong>
                  <small>${Utils.esc(user.email)} · ${Utils.esc(user.role)}</small>
                </div>
                ${Auth.canView('configuracion') ? `<a href="#/configuracion" data-go="configuracion">${Components.icon('bi-gear')} Configuración</a>` : ''}
                <button type="button" class="danger" data-action="logout">${Components.icon('bi-box-arrow-right')} Cerrar sesión</button>
              </div>
            </div>
            <button type="button" class="burger-g d-lg-none" id="burger" data-action="toggle-menu" aria-expanded="false" aria-controls="mobile-menu">
              ${Components.icon('bi-list')}<span class="visually-hidden">Abrir menú de navegación</span>
            </button>
          </div>
        </div>
        <nav class="mobile-menu-g d-lg-none" id="mobile-menu" aria-label="Principal (móvil)" hidden>
          <div class="container-xl py-3">
            <ul class="list-unstyled m-0">
              ${items.map(k => `<li><a href="#/${k}" data-go="${k}" class="nav-mobile-g${k === activePage ? ' active' : ''}"${current(k)}>${Components.icon(ROUTES[k].icon)} ${ROUTES[k].title}</a></li>`).join('')}
            </ul>
            <div class="d-flex gap-2 mt-3 pt-3 mobile-menu-foot">
              <a href="${helpHref}" class="btn btn-brand flex-fill">${Components.icon('bi-headset')} Solicitar asistencia</a>
              <button type="button" class="btn btn-ghost-light" data-action="logout">${Components.icon('bi-box-arrow-right')}<span class="visually-hidden">Cerrar sesión</span></button>
            </div>
          </div>
        </nav>
      </header>

      <main id="main" class="page-g" tabindex="-1"></main>

      <footer class="footer-g">
        <div class="container-xl d-flex flex-column flex-sm-row justify-content-between gap-2">
          <span>© ${new Date().getFullYear()} ${Utils.esc(CONFIG.app.company)} — ${Utils.esc(CONFIG.app.country)}</span>
          <span class="mono">v${Utils.esc(CONFIG.app.version)}${Api.mode === 'mock' ? ' · modo demostración' : ''}</span>
        </div>
      </footer>
    </div>`;
  },

  // ── Menús del navbar ──
  toggleMenu(force) {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('burger');
    if (!menu || !btn) return;
    const open = force !== undefined ? force : menu.hidden;
    menu.hidden = !open;
    requestAnimationFrame(() => menu.classList.toggle('open', open));
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = Components.icon(open ? 'bi-x-lg' : 'bi-list')
      + `<span class="visually-hidden">${open ? 'Cerrar' : 'Abrir'} menú de navegación</span>`;
    if (open) menu.querySelector('a, button')?.focus();
  },

  toggleProfile(force) {
    const wrap = document.getElementById('profile');
    if (!wrap) return;
    const menu = document.getElementById('profile-menu');
    const btn = wrap.querySelector('.profile-btn');
    const open = force !== undefined ? force : menu.hidden;
    menu.hidden = !open;
    wrap.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('a, button')?.focus();
  },

  // returnFocus: al cerrar con Escape, el foco vuelve al botón que abrió el menú
  closeMenus(returnFocus = false) {
    const profileOpen = document.getElementById('profile')?.classList.contains('open');
    const menuOpen = document.getElementById('mobile-menu') && !document.getElementById('mobile-menu').hidden;
    if (profileOpen) {
      Components.toggleProfile(false);
      if (returnFocus) document.querySelector('.profile-btn')?.focus();
    }
    if (menuOpen) {
      Components.toggleMenu(false);
      if (returnFocus) document.getElementById('burger')?.focus();
    }
  },

  // ── Hero de cada página interna ──
  pageHero({ eyebrow, title, accent = '', subtitle = '', subtitleId = '', actions = '', image = 'racks' }) {
    return `
    <section class="hero-g hero-page" data-bg="${image}" aria-labelledby="page-title">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="container-xl position-relative d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-4">
        <div class="stagger">
          ${eyebrow ? `<p class="eyebrow-g reveal"><span aria-hidden="true"></span>${eyebrow}</p>` : ''}
          <h1 class="hero-title-sm reveal" id="page-title" tabindex="-1">${title}${accent ? ` <em>${accent}</em>` : ''}</h1>
          <p class="hero-sub reveal"${subtitleId ? ` id="${subtitleId}"` : ''}>${subtitle}</p>
        </div>
        ${actions ? `<div class="d-flex flex-wrap gap-2 reveal">${actions}</div>` : ''}
      </div>
    </section>`;
  },

  // Aplica las fotos de fondo vía CSSOM (compatible con CSP estricta)
  applyBackgrounds(root) {
    root.querySelectorAll('[data-bg]').forEach(el => {
      const url = CONFIG.images[el.dataset.bg];
      if (url) el.style.setProperty('--hero-img', `url("${url.replace(/"/g, '%22')}")`);
    });
  },

  sectionHeader(title, eyebrow = '', id = '') {
    return `
    <div class="section-head-g">
      <div>
        ${eyebrow ? `<p class="kicker-g">${eyebrow}</p>` : ''}
        <h2${id ? ` id="${id}"` : ''}>${title}</h2>
      </div>
    </div>`;
  },

  statCard(label, value, icon, tone = 'brand', tag = '', alert = false) {
    return `
    <li class="col-6 col-md-4 col-lg reveal">
      <div class="stat-g tone-${tone}">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <span class="stat-icon-g">${Components.icon(icon)}</span>
          ${tag}
        </div>
        <p class="stat-value">${Utils.esc(value)}</p>
        <p class="stat-label">${label}</p>
        ${alert ? '<span class="stat-alert" aria-hidden="true"></span>' : ''}
      </div>
    </li>`;
  },

  // ── Modal ── role: 'dialog' | 'alertdialog'
  modal(id, titleHtml, bodyHtml, footerHtml = '', size = '', role = 'dialog') {
    return `
    <div id="${id}" class="modal-g" aria-hidden="true">
      <div class="modal-box-g ${size}" role="${role}" aria-modal="true" aria-labelledby="${id}-title">
        <div class="modal-head-g">
          <h2 id="${id}-title">${titleHtml}</h2>
          <button type="button" class="modal-x" data-action="modal-close">${Components.icon('bi-x-lg')}<span class="visually-hidden">Cerrar</span></button>
        </div>
        <div class="modal-body-g">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-foot-g">${footerHtml}</div>` : ''}
      </div>
    </div>`;
  },

  // ── Campo de formulario accesible (label + ayuda + error enlazados) ──
  field({ id, name, label, type = 'text', placeholder = '', required = false, autocomplete = 'off', hint = '', inputmode = '', cls = '', value = '' }) {
    const describedBy = [hint ? id + '-hint' : '', id + '-error'].filter(Boolean).join(' ');
    return `
    <div class="mb-3">
      <label for="${id}" class="form-label label-g">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
      <input type="${type}" id="${id}" name="${name}" class="form-control input-g ${cls}" placeholder="${Utils.esc(placeholder)}"
        autocomplete="${autocomplete}" ${inputmode ? `inputmode="${inputmode}"` : ''} ${required ? 'required aria-required="true"' : ''}
        aria-describedby="${describedBy}" value="${Utils.esc(value)}">
      ${hint ? `<p class="field-hint" id="${id}-hint">${hint}</p>` : ''}
      <p class="field-error" id="${id}-error" hidden></p>
    </div>`;
  },

  selectField({ id, name, label, options, required = false, hint = '' }) {
    const opts = options.map(o => (typeof o === 'string'
      ? `<option value="${Utils.esc(o)}">${Utils.esc(o)}</option>`
      : `<option value="${Utils.esc(o.value)}">${Utils.esc(o.label)}</option>`)).join('');
    const describedBy = [hint ? id + '-hint' : '', id + '-error'].filter(Boolean).join(' ');
    return `
    <div class="mb-3">
      <label for="${id}" class="form-label label-g">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
      <select id="${id}" name="${name}" class="form-select input-g" ${required ? 'required aria-required="true"' : ''} aria-describedby="${describedBy}">${opts}</select>
      ${hint ? `<p class="field-hint" id="${id}-hint">${hint}</p>` : ''}
      <p class="field-error" id="${id}-error" hidden></p>
    </div>`;
  },

  formIntro() {
    return '<p class="form-note">Los campos con <span class="req" aria-hidden="true">*</span><span class="visually-hidden">asterisco</span> son obligatorios.</p><p class="form-summary" hidden></p>';
  },

  // ── Badge ──
  badge(text, type = 'default', dot = false) {
    const classes = {
      pri: 'badge-g-brand', grn: 'badge-g-green', red: 'badge-g-red',
      ylw: 'badge-g-amber', dark: 'badge-g-dark', default: 'badge-g-slate',
    };
    return `<span class="badge-g ${classes[type] || classes.default}">${dot ? '<i class="dot" aria-hidden="true"></i>' : ''}${Utils.esc(text)}</span>`;
  },

  empty(text) {
    return `<p class="empty-g">${text}</p>`;
  },

  // ── Estado del activo: asignación (Asignado/Disponible) + condición operativa (Operativo, En reparación…) ──
  assetBadges(a) {
    const cond = a.condition ? CONFIG.catalogs.assetConditions.find(c => c.value === a.condition) : null;
    return `<span class="badge-stack">
      ${Components.badge(a.status, a.status === 'Asignado' ? 'pri' : 'grn', true)}
      ${a.condition ? `<span class="visually-hidden">, condición: </span>${Components.badge(a.condition, cond ? cond.badge : 'default')}` : ''}
    </span>`;
  },

  // Garantía: fecha + texto de estado (no depende solo del color)
  warranty(dateValue) {
    const d = Utils.toDate(dateValue);
    if (!d) return { text: 'Sin información', tone: 'default', detail: '' };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) return { text: 'Vencida', tone: 'red', detail: `venció el ${Utils.formatDate(d)}` };
    const months = Math.round(days / 30.44);
    const left = months >= 1 ? `${months} ${months === 1 ? 'mes' : 'meses'}` : `${days} ${days === 1 ? 'día' : 'días'}`;
    return { text: days <= 60 ? 'Por vencer' : 'Vigente', tone: days <= 60 ? 'ylw' : 'grn', detail: `vence en ${left}` };
  },

  /* ── Foto real del notebook (la del video promocional) con puntos numerados ──
   * El equipo NO se abre: cada punto marca dónde vive el componente y se enlaza con su ficha
   * (mismo número). Al pasar el cursor por una ficha se enciende su punto (CSS :has, sin JS).
   * Coordenadas en % sobre img/notebook-real.webp (900×710). Decorativo: la información está en el <dl>. */
  PHOTO_PINS: [
    { n: 1, key: 'cpu', label: 'CPU', x: 48.9, y: 71.5 },
    { n: 2, key: 'ram', label: 'RAM', x: 71, y: 73.5 },
    { n: 3, key: 'storage', label: 'SSD', x: 33, y: 80 },
  ],

  devicePhoto(specs = {}) {
    const pins = Components.PHOTO_PINS.map((p, i) => `
        <span class="hwc-pin" data-pin="${p.n}" style="--x:${p.x}%;--y:${p.y}%;--pd:${620 + i * 110}ms">
          <b>${p.n}</b><em>${Utils.esc(p.label)}${specs[p.key] ? ' · ' + Utils.esc(specs[p.key]) : ''}</em>
        </span>`).join('');
    return `
      <figure class="hwc-photo" data-hwc-reveal style="--d:20ms" aria-hidden="true">
        <img src="${Utils.esc(CONFIG.images.notebookPhoto)}" alt="" width="900" height="710" decoding="async" data-hide-on-error>
        <span class="hwc-photo-sweep"></span>
        ${pins}
      </figure>`;
  },

  // ── Ilustración del equipo para la Hardware Asset Card (decorativa; el tono sigue la condición operativa) ──
  deviceArt(type, tone = 'grn') {
    const screen = `
        <rect class="dv-screen" x="0" y="0" width="132" height="82" rx="5"/>
        <g class="dv-ui">
          <rect x="9" y="9" width="114" height="7" rx="3.5" class="dv-bar"/>
          <circle cx="14" cy="12.5" r="1.4" class="dv-dot"/><circle cx="19" cy="12.5" r="1.4" class="dv-dot"/>
          <rect x="9" y="24" width="30" height="49" rx="3" class="dv-pane"/>
          <rect x="44" y="24" width="79" height="21" rx="3" class="dv-pane"/>
          <polyline class="dv-chart" points="48,70 62,62 74,66 88,54 102,58 118,48"/>
          <rect x="44" y="50" width="79" height="23" rx="3" class="dv-pane dv-pane-b"/>
        </g>
        <rect class="dv-scan" x="0" y="0" width="132" height="14"/>
        <path class="dv-glare" d="M0 0h58L22 82H0z"/>`;
    if (type === 'PC') {
      return `
      <svg class="hwc-art tone-${tone}" viewBox="0 0 240 150" focusable="false" aria-hidden="true">
        <ellipse class="dv-floor" cx="120" cy="140" rx="86" ry="7"/>
        <rect class="dv-tower" x="178" y="58" width="34" height="76" rx="6"/><circle class="dv-led" cx="195" cy="72" r="2.6"/><rect x="184" y="84" width="22" height="3" rx="1.5" class="dv-slot"/><rect x="184" y="91" width="22" height="3" rx="1.5" class="dv-slot"/>
        <path class="dv-stand" d="M108 112h24l5 22H103z"/><rect class="dv-foot" x="88" y="132" width="64" height="5" rx="2.5"/>
        <g class="dv-lid"><rect class="dv-bezel" x="50" y="20" width="140" height="92" rx="9"/><g transform="translate(54 25)">${screen}</g></g>
      </svg>`;
    }
    return `
      <svg class="hwc-art tone-${tone}" viewBox="0 0 240 150" focusable="false" aria-hidden="true">
        <ellipse class="dv-floor" cx="120" cy="138" rx="104" ry="8"/>
        <g class="dv-lid"><rect class="dv-bezel" x="50" y="22" width="140" height="90" rx="9"/><g transform="translate(54 26)">${screen}</g></g>
        <path class="dv-base" d="M26 112h188l-10 18a8 8 0 0 1-7 4H43a8 8 0 0 1-7-4z"/>
        <path class="dv-hinge" d="M98 112h44v3a4 4 0 0 1-4 4h-36a4 4 0 0 1-4-4z"/>
        <g class="dv-keys">${Array.from({ length: 3 }, (_, r) => `<path d="M${50 - r * 3} ${119 + r * 4}h${140 + r * 6}" />`).join('')}</g>
      </svg>`;
  },

  /* ── Hardware Asset Card ──────────────────────────────────────────────────────────
   * Tarjeta de activo con ficha técnica. La coreografía (entrada escalonada, tilt 3D y luz que
   * sigue al cursor) la agrega js/motion.js; sin JS de movimiento la tarjeta se ve completa y estática.
   *  - Semántica: <article> con título (aria-labelledby) y resumen (aria-describedby); las
   *    especificaciones son un <dl> (lectores de pantalla leen "término: valor").
   *  - Los estados no dependen del color: cada badge lleva texto y prefijo oculto ("Condición:").
   *  - data-hwc-reveal + --d: orden y retardo de la entrada (0 → 40 → chips cada 35 ms → 180 ms).
   * opts: { uid: sufijo único para los id, actions: HTML de acciones para el pie, headingTag: 'h3' }
   */
  hardwareCard(a, opts = {}) {
    const uid = 'hwc-' + String(opts.uid || a.id).replace(/[^\w-]/g, '');
    const H = opts.headingTag || 'h3';
    const s = a.specs || {};
    const w = Components.warranty(a.warrantyUntil);
    const e = Utils.esc;
    const title = a.brand && a.model ? `${a.brand} ${a.model}` : a.name;
    const sub = [s.display, s.os].filter(Boolean).join(' · ');
    const cond = a.condition ? CONFIG.catalogs.assetConditions.find(c => c.value === a.condition) : null;
    const resp = a.assignedTo && a.assignedTo.name ? a.assignedTo : null;
    const place = [resp && resp.area, [a.location, a.floor].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    const STAGGER = 35, CHIP0 = 70;   // ms: los chips arrancan tras el badge de estado (40 ms)

    // Con foto real, los chips 1–3 llevan el número del punto que los ubica en el equipo
    const photo = a.type === 'Notebook' && CONFIG.images.notebookPhoto;
    const chip = (i, icon, label, value, detail, extra = '') => `
      <div class="hwc-chip" data-hwc-reveal style="--d:${CHIP0 + i * STAGGER}ms"${photo && i < 3 ? ` data-pin="${i + 1}"` : ''}>
        <dt>${photo && i < 3 ? `<span class="hwc-num" aria-hidden="true">${i + 1}</span>` : Components.icon(icon)}<span>${label}</span></dt>
        <dd><strong>${value}</strong>${detail ? `<span>${detail}</span>` : ''}${extra}</dd>
      </div>`;

    return `
    <article class="hwc" id="${uid}" aria-labelledby="${uid}-title" aria-describedby="${uid}-sub">
      <span class="hwc-spot" aria-hidden="true"></span>

      <header class="hwc-head" data-hwc-reveal style="--d:0ms">
        <div class="hwc-tags">
          <span class="hwc-tag"><span class="visually-hidden">Código interno: </span>${e(a.id)}</span>
          ${a.assetTag ? `<span class="hwc-tag"><span class="visually-hidden">Etiqueta de activo: </span>${e(a.assetTag)}</span>` : ''}
          ${a.segment ? `<span class="hwc-seg">${e(a.segment)}</span>` : ''}
        </div>
        <div class="hwc-title-row">
          <span class="hwc-glyph" aria-hidden="true">${Components.icon(Utils.assetType(a.type).icon)}</span>
          <div class="hwc-min">
            <${H} class="hwc-title" id="${uid}-title">${e(title)}</${H}>
            <p class="hwc-sub" id="${uid}-sub">${e(Utils.assetType(a.type).label)}${sub ? ' · ' + e(sub) : ''}</p>
          </div>
        </div>
      </header>

      ${photo ? Components.devicePhoto(s) : `<div class="hwc-stage" data-hwc-reveal style="--d:20ms" aria-hidden="true">${Components.deviceArt(a.type, cond ? cond.badge : 'grn')}</div>`}

      <div class="hwc-status" data-hwc-reveal style="--d:40ms">
        ${a.condition ? `<span class="hwc-badge tone-${cond ? cond.badge : 'default'}"><i class="hwc-pulse" aria-hidden="true"></i><span class="visually-hidden">Condición: </span>${e(a.condition)}</span>` : ''}
        <span class="hwc-badge ${a.status === 'Asignado' ? 'tone-pri' : 'tone-grn'}"><span class="visually-hidden">Asignación: </span>${e(a.status)}</span>
        <div class="hwc-serial">
          <span class="hwc-k">N° de serie</span>
          <span class="hwc-sn" id="${uid}-sn">${e(a.serial)}</span>
          <button type="button" class="hwc-copy" data-action="hwc-copy" data-target="${uid}-sn" data-live="${uid}-live"
            aria-label="Copiar número de serie ${e(a.serial)}">${Components.icon('bi-copy', 'i-copy')}${Components.icon('bi-check2', 'i-ok')}</button>
        </div>
      </div>

      <dl class="hwc-specs">
        ${chip(0, 'bi-cpu', 'Procesador', e(s.cpu || 'No informado'), e(s.cpuDetail || ''))}
        ${chip(1, 'bi-memory', 'Memoria RAM', e(s.ram || 'No informado'), e(s.ramDetail || ''))}
        ${chip(2, 'bi-device-ssd', 'Almacenamiento', e(s.storage || 'No informado'), e(s.storageDetail || ''))}
        ${chip(3, 'bi-shield-check', 'Garantía',
          a.warrantyUntil ? `Hasta <time datetime="${e(a.warrantyUntil)}">${e(Utils.formatDate(a.warrantyUntil))}</time>` : 'Sin información',
          e([a.warrantyPlan, w.detail].filter(Boolean).join(' · ')),
          `<span class="hwc-mini tone-${w.tone}">${e(w.text)}</span>`)}
      </dl>

      <footer class="hwc-foot" data-hwc-reveal style="--d:180ms">
        <span class="hwc-avatar" aria-hidden="true">${resp ? e(Utils.initials(resp.name)) : Components.icon('bi-person')}</span>
        <p class="hwc-who">
          <span class="hwc-k">Asignado a</span>
          <strong>${resp ? e(resp.name) : 'Sin asignar'}</strong>
          ${place ? `<span>${e(place)}</span>` : ''}
        </p>
        ${opts.actions ? `<div class="hwc-actions">${opts.actions}</div>` : ''}
      </footer>
      <p class="visually-hidden" id="${uid}-live" aria-live="polite"></p>
    </article>`;
  },

  // ── Ficha técnica accesible: <dl> agrupada y etiquetada (lectores de pantalla leen "término: valor") ──
  specSheet(a) {
    const s = a.specs || {};
    const w = Components.warranty(a.warrantyUntil);
    const type = Utils.assetType(a.type);
    const row = (icon, label, value, cls = '') => `
      <div class="sheet-row${cls ? ' ' + cls : ''}">
        <dt>${Components.icon(icon)} ${label}</dt>
        <dd>${value}</dd>
      </div>`;
    const txt = v => (v ? Utils.esc(v) : '<span class="text-secondary">No informado</span>');
    const resp = a.assignedTo && a.assignedTo.name
      ? `${Utils.esc(a.assignedTo.name)}${a.assignedTo.area ? ` <span class="text-secondary">· ${Utils.esc(a.assignedTo.area)}</span>` : ''}`
      : '<span class="text-secondary">Sin asignar</span>';

    return `
    <div class="sheet-head">
      <span class="type-icon" aria-hidden="true">${Components.icon(type.icon)}</span>
      <div class="min-w-0">
        <p class="sheet-kicker">${Utils.esc(type.label)}${a.assetTag ? ` · <span class="mono">${Utils.esc(a.assetTag)}</span>` : ''}</p>
        <p class="sheet-title">${Utils.esc(a.brand && a.model ? `${a.brand} ${a.model}` : a.name)}</p>
        ${Components.assetBadges(a)}
      </div>
    </div>

    <section class="sheet-group" aria-labelledby="sheet-id-title">
      <h3 class="sheet-h" id="sheet-id-title">Identificación</h3>
      <dl class="sheet-dl">
        ${row('bi-hash', 'N° de serie', `<span class="mono">${txt(a.serial)}</span>`, 'wide')}
        ${a.id != null ? row('bi-upc', 'Código interno', `<span class="mono">${Utils.esc(a.id)}</span>`) : ''}
        ${row('bi-geo-alt', 'Ubicación', txt(a.location))}
        ${row('bi-person', 'Responsable', resp, 'wide')}
      </dl>
    </section>

    <section class="sheet-group" aria-labelledby="sheet-spec-title">
      <h3 class="sheet-h" id="sheet-spec-title">Especificaciones técnicas</h3>
      <dl class="sheet-dl">
        ${row('bi-cpu', 'Procesador (CPU)', txt(s.cpu), 'wide')}
        ${row('bi-memory', 'Memoria RAM', txt(s.ram))}
        ${row('bi-device-ssd', 'Almacenamiento', txt(s.storage))}
        ${s.display ? row('bi-display', 'Pantalla', txt(s.display)) : ''}
        ${s.os ? row('bi-windows', 'Sistema operativo', txt(s.os)) : ''}
      </dl>
    </section>

    <section class="sheet-group" aria-labelledby="sheet-war-title">
      <h3 class="sheet-h" id="sheet-war-title">Garantía</h3>
      <dl class="sheet-dl">
        ${row('bi-shield-check', 'Vencimiento', a.warrantyUntil
          ? `<time datetime="${Utils.esc(a.warrantyUntil)}">${Utils.esc(Utils.formatDate(a.warrantyUntil))}</time>`
          : txt(''))}
        ${row('bi-info-circle', 'Estado', `${Components.badge(w.text, w.tone)}${w.detail ? ` <span class="text-secondary small">${Utils.esc(w.detail)}</span>` : ''}`)}
      </dl>
    </section>`;
  },
};

// Cerrar el menú de perfil al hacer clic fuera
document.addEventListener('click', (e) => {
  const p = document.getElementById('profile');
  if (p && p.classList.contains('open') && !p.contains(e.target)) Components.toggleProfile(false);
});

// Navbar más opaco al hacer scroll
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

// Copiar el N° de serie de una Hardware Asset Card (se registra cuando Actions ya existe)
document.addEventListener('DOMContentLoaded', () => Actions.register({
  'hwc-copy': async (btn) => {
    const target = document.getElementById(btn.dataset.target);
    const live = document.getElementById(btn.dataset.live);
    if (!target) return;
    let ok = true;
    try { await navigator.clipboard.writeText(target.textContent.trim()); }
    catch { // sin permiso de portapapeles: se deja el texto seleccionado para Ctrl+C
      ok = false;
      const r = document.createRange(); r.selectNodeContents(target);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    if (live) live.textContent = ok ? 'Número de serie copiado.' : 'Número de serie seleccionado; use Ctrl+C para copiarlo.';
    btn.classList.remove('is-copied'); void btn.offsetWidth;   // reinicia la animación si se pulsa seguido
    btn.classList.add('is-copied');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove('is-copied'); if (live) live.textContent = ''; }, 1800);
  },
}));
