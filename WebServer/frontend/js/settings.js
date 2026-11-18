/* ═══ settings.js — Configuración: preferencias del usuario e información del sistema ═══ */

const Settings = {
  template() {
    const user = Auth.getUser();
    const perms = CONFIG.permissions[user.role] || [];
    const prefs = A11y.getPrefs();
    const row = (label, value, mono = false) => `<div class="info-row"><dt>${label}</dt><dd class="${mono ? 'mono' : ''}">${value}</dd></div>`;

    return `
    ${Components.pageHero({ eyebrow: 'Plataforma', title: 'Configuración', subtitle: 'Preferencias de uso e información de la instalación.', image: 'configuracion' })}
    <div class="container-xl page-body">
      <div class="row g-4 stagger">
        <section class="col-lg-6 reveal" aria-labelledby="prefs-title">
          <div class="card-g h-100">
            <p class="kicker-g">Accesibilidad</p>
            <h2 class="card-title-g" id="prefs-title">Preferencias</h2>
            <div class="form-check form-switch switch-g">
              <input class="form-check-input" type="checkbox" role="switch" id="pref-motion" data-change="pref-motion" ${prefs.reduceMotion ? 'checked' : ''} aria-describedby="pref-motion-hint">
              <label class="form-check-label fw-semibold" for="pref-motion">Reducir animaciones</label>
              <p class="field-hint" id="pref-motion-hint">Desactiva transiciones y efectos de movimiento. También se activa solo si su sistema operativo lo pide.</p>
            </div>
            <p class="field-hint mt-3 mb-0">Para agrandar el texto use el zoom del navegador (<kbd>Ctrl</kbd> + <kbd>+</kbd>); el diseño se adapta hasta 200 %.</p>
          </div>
        </section>

        <section class="col-lg-6 reveal" aria-labelledby="account-title">
          <div class="card-g h-100">
            <p class="kicker-g">Cuenta</p>
            <h2 class="card-title-g" id="account-title">Su sesión</h2>
            <dl class="info-list">
              ${row('Nombre', Utils.esc(user.name))}
              ${row('Email', Utils.esc(user.email))}
              ${row('Rol', Utils.esc(user.role))}
              ${row('Permisos', perms.includes('*') ? 'Todos' : Utils.esc(perms.join(', ')), true)}
              ${row('Cierre por inactividad', `${CONFIG.auth.sessionTimeoutMin} minutos`)}
            </dl>
          </div>
        </section>

        <section class="col-12 reveal" aria-labelledby="system-title">
          <div class="card-g">
            <p class="kicker-g">Instalación</p>
            <h2 class="card-title-g" id="system-title">Información del sistema</h2>
            <dl class="info-list info-cols">
              ${row('Versión del frontend', Utils.esc(CONFIG.app.version), true)}
              ${row('Origen de datos', Api.mode === 'http' ? 'Backend (http)' : 'Demostración local (mock)')}
              ${row('URL de la API', Utils.esc(CONFIG.api.baseUrl), true)}
              ${row('Tiempo máximo de respuesta', `${CONFIG.api.timeoutMs / 1000} s`)}
              ${row('Autenticación', CONFIG.api.withCredentials ? 'Cookie de sesión' : 'Token Bearer')}
              ${row('Configuración regional', Utils.esc(CONFIG.app.locale + ' · ' + CONFIG.app.currency), true)}
            </dl>
            ${Api.mode === 'mock' && Auth.can('users.write') ? `
            <div class="demo-box">
              <div>
                <h3 class="h6 fw-bold mb-1">Datos de demostración</h3>
                <p class="field-hint m-0">Vuelve a los activos, usuarios y registros iniciales. Solo afecta a este navegador.</p>
              </div>
              <button type="button" class="btn btn-danger-soft" data-action="demo-reset">${Components.icon('bi-arrow-counterclockwise')} Restablecer datos</button>
            </div>` : ''}
          </div>
        </section>
      </div>
    </div>`;
  },

  init() {},
};

Actions.register({
  'pref-motion': (input) => {
    A11y.setPref('reduceMotion', input.checked);
    Ui.notify(input.checked ? 'Animaciones reducidas.' : 'Animaciones activadas.', 'info');
  },
  'demo-reset': async () => {
    const ok = await Ui.confirm({
      title: 'Restablecer datos de demostración',
      message: 'Se borrarán los cambios hechos en este navegador y se cargarán los datos iniciales. Su sesión se mantiene.',
      confirmText: 'Restablecer',
      danger: true,
    });
    if (!ok) return;
    Api.resetDemoData();
    Ui.notify('Datos de demostración restablecidos.');
  },
});
