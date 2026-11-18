/* ═══ downloads.js — Módulo de Descargas ═══
 * Contenido (instalador, componentes y pasos) en CONFIG.downloads.
 */

const Downloads = {
  step: 0,

  get steps() { return CONFIG.downloads.steps; },

  template() {
    const d = CONFIG.downloads;
    return `
    ${Components.pageHero({ eyebrow: 'Instalación', title: 'Descargas', accent: 'y guía', subtitle: 'Instalador unificado y guía paso a paso.', image: 'descargas' })}
    <div class="container-xl page-body">
      <section class="installer-g reveal" aria-labelledby="installer-title">
        <div class="d-flex align-items-center gap-3">
          <span class="installer-icon-g">${Components.icon('bi-box-seam')}</span>
          <div>
            <h2 class="mono fs-5 fw-semibold m-0" id="installer-title">${Utils.esc(d.installerName)}</h2>
            <p class="installer-meta m-0">${Utils.esc(d.installerMeta)}</p>
          </div>
        </div>
        ${Utils.safeUrl(d.installerUrl)
          ? `<a class="btn btn-brand btn-lg" href="${Utils.esc(Utils.safeUrl(d.installerUrl))}" download data-action="download-track">${Components.icon('bi-download')} Descargar instalador</a>`
          : `<button type="button" class="btn btn-brand btn-lg" data-action="download-installer">${Components.icon('bi-download')} Descargar instalador</button>`}
      </section>

      <h2 class="visually-hidden">Componentes incluidos</h2>
      <ul class="row g-3 my-2 stagger list-unstyled">
        ${d.components.map(c => `
        <li class="col-md-4 reveal">
          <div class="comp-g">
            <div class="d-flex align-items-center gap-3">
              <span class="stat-icon-g">${Components.icon(c.icon)}</span>
              <div><h3 class="h6 fw-bold m-0 text-dark">${Utils.esc(c.name)}</h3><p class="mono small text-secondary m-0">${Utils.esc(c.version)}</p></div>
            </div>
            <p>${Utils.esc(c.description)}</p>
          </div>
        </li>`).join('')}
      </ul>

      <section class="panel-g tutorial-g reveal" aria-labelledby="guide-title">
        <div class="panel-toolbar">
          <h2 id="guide-title" class="h6 fw-bold m-0">Guía de instalación</h2>
          <span class="mono small text-secondary" id="tut-counter" aria-hidden="true"></span>
        </div>
        <div class="tut-progress" role="progressbar" aria-label="Avance de la guía" aria-valuemin="1" aria-valuemax="${Downloads.steps.length}" id="tut-progressbar"><div id="tut-progress"></div></div>
        <nav aria-label="Pasos de la guía"><ol class="steps-g" id="step-indicators"></ol></nav>
        <div class="row g-4 px-3 px-md-4 pb-4">
          <div class="col-md-6">
            <div id="tut-content" class="tut-content" aria-live="polite">
              <p class="kicker-g" id="tut-step-label"></p>
              <h3 class="tut-title" id="tut-title"></h3>
              <p class="text-secondary" id="tut-desc"></p>
              <div class="tut-detail">
                <p class="tut-detail-label">Detalle técnico</p>
                <p id="tut-detail"></p>
              </div>
            </div>
          </div>
          <div class="col-md-6" aria-hidden="true">
            <div class="window-g">
              <div class="window-bar"><i class="red"></i><i class="yellow"></i><i class="green"></i><span class="mono">GestioApp Setup</span></div>
              <div class="window-body">
                <span class="window-icon" id="tut-icon"></span>
                <p id="tut-icon-label"></p>
              </div>
            </div>
          </div>
        </div>
        <div class="tut-nav">
          <button type="button" class="btn btn-soft" id="tut-prev" data-action="tut-prev">${Components.icon('bi-arrow-left')} Anterior</button>
          <button type="button" class="btn btn-brand" id="tut-next" data-action="tut-next"></button>
        </div>
      </section>
    </div>`;
  },

  init() {
    Downloads.step = 0;
    Downloads.renderStep(false);
  },

  renderIndicators() {
    const total = Downloads.steps.length;
    document.getElementById('step-indicators').innerHTML = Downloads.steps.map((s, i) => {
      const cls = i === Downloads.step ? 'active' : i < Downloads.step ? 'done' : 'pending';
      const state = i < Downloads.step ? ' (completado)' : i === Downloads.step ? ' (actual)' : '';
      return `<li class="${i < Downloads.step ? 'done' : ''}">
        <button type="button" class="step-dot ${cls}" data-action="tut-goto" data-step="${i}"${i === Downloads.step ? ' aria-current="step"' : ''}>
          <span aria-hidden="true">${i < Downloads.step ? Components.icon('bi-check-lg') : i + 1}</span>
          <span class="visually-hidden">Paso ${i + 1}: ${Utils.esc(s.title)}${state}</span>
        </button>
        ${i < total - 1 ? '<span class="step-line" aria-hidden="true"></span>' : ''}
      </li>`;
    }).join('');
  },

  renderStep(animate = true) {
    const s = Downloads.steps[Downloads.step];
    const total = Downloads.steps.length;
    const n = Downloads.step + 1;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    set('tut-counter', `Paso ${n} de ${total}`);
    set('tut-step-label', `Paso ${n} de ${total}`);
    set('tut-title', s.title);
    set('tut-desc', s.description);
    set('tut-detail', s.detail);
    set('tut-icon-label', s.title);
    document.getElementById('tut-icon').innerHTML = Components.icon(s.icon);
    document.getElementById('tut-progress').style.width = (n / total * 100) + '%';
    const bar = document.getElementById('tut-progressbar');
    bar.setAttribute('aria-valuenow', n);
    bar.setAttribute('aria-valuetext', `Paso ${n} de ${total}`);

    if (animate) {
      ['tut-content', 'tut-icon'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('swap');
        void el.offsetWidth;
        el.classList.add('swap');
      });
    }

    const prev = document.getElementById('tut-prev');
    prev.disabled = Downloads.step === 0;
    const next = document.getElementById('tut-next');
    const last = Downloads.step === total - 1;
    next.innerHTML = last ? `${Components.icon('bi-check-lg')} Guía completada` : `Siguiente ${Components.icon('bi-arrow-right')}`;
    next.disabled = last;

    Downloads.renderIndicators();
  },

  go(step, focusTarget) {
    Downloads.step = Math.max(0, Math.min(Downloads.steps.length - 1, step));
    Downloads.renderStep();
    // Mantener el foco en un control útil (el botón pulsado pudo quedar deshabilitado)
    const el = focusTarget === 'dot'
      ? document.querySelector('.step-dot[aria-current="step"]')
      : document.getElementById(focusTarget);
    if (el && !el.disabled) {
      el.focus();
    } else {
      const title = document.getElementById('tut-title');
      title.setAttribute('tabindex', '-1');
      title.focus();
    }
  },

  simulateDownload() {
    Ui.notify(`Descarga simulada: ${CONFIG.downloads.installerName}. Configure downloads.installerUrl para usar el archivo real.`, 'info');
    Api.track(`Descargó instalador ${CONFIG.downloads.installerName}`, 'info');
  },
};

Actions.register({
  'tut-next': () => Downloads.go(Downloads.step + 1, 'tut-next'),
  'tut-prev': () => Downloads.go(Downloads.step - 1, 'tut-prev'),
  'tut-goto': (btn) => Downloads.go(Number(btn.dataset.step), 'dot'),
  'download-installer': () => Downloads.simulateDownload(),
  // enlace real: dejar que el navegador descargue y solo registrar el evento
  'download-track': () => {
    Api.track(`Descargó instalador ${CONFIG.downloads.installerName}`, 'info');
  },
});
