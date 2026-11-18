/* ═══ ui.js — Comportamientos de interfaz reutilizables ═══
 * notify · modales accesibles · confirmación · errores de formulario · estados de carga · animaciones
 */

const Ui = {
  /* ─────────────── Notificaciones ─────────────── */
  notify(msg, type = 'success') {
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    const kind = icons[type] ? type : 'success';
    // Lector de pantalla: errores y advertencias interrumpen, el resto espera
    A11y.announce(msg, kind === 'error' || kind === 'warning');

    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.className = 'toast-g toast-' + kind;
    toast.innerHTML = `<i class="bi ${icons[kind]}" aria-hidden="true"></i><span></span>`;
    toast.querySelector('span').textContent = msg;
    void toast.offsetWidth; // reinicia la transición
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), kind === 'error' ? 6000 : 3500);
  },

  // Muestra un ApiError: errores por campo junto a cada input + aviso general
  showError(err, formEl = null, fieldMap = {}) {
    if (err && err.fieldErrors && formEl) {
      const mapped = {};
      Object.entries(err.fieldErrors).forEach(([field, msg]) => { mapped[fieldMap[field] || field] = msg; });
      if (Ui.form.setErrors(formEl, mapped)) return;
    }
    Ui.notify((err && err.message) || 'Ocurrió un error inesperado.', 'error');
    if (err && !(err instanceof ApiError)) console.error(err);
  },

  /* ─────────────── Modales ───────────────
   * Los modales se mueven a #modal-root (fuera de #app) para poder marcar el resto
   * de la página como `inert` mientras están abiertos. */
  _modalStack: [],

  mountModals(container) {
    const root = document.getElementById('modal-root');
    container.querySelectorAll('.modal-g').forEach(m => root.appendChild(m));
  },

  clearModals() {
    Ui._modalStack.forEach(entry => entry.release());
    Ui._modalStack = [];
    document.getElementById('modal-root').innerHTML = '';
    document.getElementById('app').inert = false;
    document.body.classList.remove('modal-lock');
  },

  openModal(id, focusSelector = null) {
    const modal = document.getElementById(id);
    if (!modal || modal.classList.contains('open')) return;
    const opener = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('app').inert = true;
    Ui._modalStack.forEach(e => { e.modal.inert = true; });
    document.body.classList.add('modal-lock');

    const release = A11y.trapFocus(modal);
    Ui._modalStack.push({ id, modal, opener, release });

    // El modal pasa de visibility:hidden a visible con una transición: mientras dura, Chrome puede rechazar focus().
    // Se intenta a los 50 ms y se reintenta hasta que el foco quede realmente dentro del modal.
    const target = (focusSelector && modal.querySelector(focusSelector))
      || modal.querySelector('[autofocus], .modal-body-g input, .modal-body-g select, .modal-body-g textarea')
      || A11y.focusables(modal)[0];
    const focusIn = (tries = 0) => {
      if (!target || !modal.classList.contains('open') || modal.contains(document.activeElement)) return;
      target.focus();
      if (document.activeElement !== target && tries < 8) setTimeout(() => focusIn(tries + 1), 50);
    };
    setTimeout(focusIn, 50);
  },

  closeModal(id) {
    const i = Ui._modalStack.findIndex(e => e.id === id);
    if (i < 0) return;
    const [entry] = Ui._modalStack.splice(i, 1);
    entry.release();
    entry.modal.classList.remove('open');
    entry.modal.setAttribute('aria-hidden', 'true');
    const top = Ui._modalStack[Ui._modalStack.length - 1];
    if (top) top.modal.inert = false;
    if (!Ui._modalStack.length) {
      document.getElementById('app').inert = false;
      document.body.classList.remove('modal-lock');
    }
    if (entry.opener && document.contains(entry.opener)) entry.opener.focus();
  },

  closeTopModal() {
    const top = Ui._modalStack[Ui._modalStack.length - 1];
    if (top) { Ui.closeModal(top.id); return true; }
    return false;
  },

  // Diálogo de confirmación accesible. Devuelve Promise<boolean>.
  confirm({ title = '¿Confirmar acción?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
    return new Promise((resolve) => {
      const id = 'modal-confirm-' + Date.now();
      const wrap = document.createElement('div');
      wrap.innerHTML = Components.modal(id, Utils.esc(title),
        `<p class="mb-0" id="${id}-desc">${Utils.esc(message)}</p>`,
        `<button type="button" class="btn btn-soft" data-confirm="no">${Utils.esc(cancelText)}</button>
         <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-brand'}" data-confirm="yes">${Utils.esc(confirmText)}</button>`,
        'modal-sm-g', 'alertdialog');
      const modal = wrap.firstElementChild;
      modal.querySelector('[role="alertdialog"]').setAttribute('aria-describedby', id + '-desc');
      document.getElementById('modal-root').appendChild(modal);

      const done = (value) => {
        Ui.closeModal(id);
        modal.removeEventListener('click', onClick);
        setTimeout(() => modal.remove(), 300);
        resolve(value);
      };
      const onClick = (e) => {
        const btn = e.target.closest('[data-confirm]');
        if (btn) done(btn.dataset.confirm === 'yes');
        else if (e.target.closest('[data-action="modal-close"]') || e.target === modal) done(false);
      };
      modal.addEventListener('click', onClick);
      modal._onEscape = () => done(false);
      Ui.openModal(id, '[data-confirm="no"]');
    });
  },

  /* ─────────────── Formularios ─────────────── */
  form: {
    // Lee los campos con [name] de un formulario → objeto con strings recortados
    read(formEl) {
      const data = {};
      formEl.querySelectorAll('[name]').forEach(el => {
        data[el.name] = el.type === 'checkbox' ? el.checked : String(el.value).trim();
      });
      return data;
    },

    fill(formEl, data) {
      Object.entries(data).forEach(([k, v]) => {
        const el = formEl.querySelector(`[name="${k}"]`);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
      });
    },

    reset(formEl) {
      formEl.reset();
      Ui.form.clearErrors(formEl);
    },

    clearErrors(formEl) {
      formEl.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
      formEl.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; el.hidden = true; });
      const summary = formEl.querySelector('.form-summary');
      if (summary) { summary.hidden = true; summary.textContent = ''; }
    },

    // errors = { nombreCampo: 'mensaje' }. Devuelve true si mostró al menos un error.
    setErrors(formEl, errors) {
      Ui.form.clearErrors(formEl);
      let first = null;
      let shown = 0;
      Object.entries(errors).forEach(([name, msg]) => {
        const input = formEl.querySelector(`[name="${name}"]`) || formEl.querySelector('#' + CSS.escape(name));
        if (!input) return;
        const errEl = document.getElementById(input.id + '-error');
        input.setAttribute('aria-invalid', 'true');
        if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
        if (!first) first = input;
        shown++;
      });
      if (!shown) return false;
      const summary = formEl.querySelector('.form-summary');
      const text = shown === 1 ? 'Hay 1 campo por corregir.' : `Hay ${shown} campos por corregir.`;
      if (summary) { summary.textContent = text; summary.hidden = false; }
      A11y.announce(text + ' ' + Object.values(errors)[0], true);
      if (first) first.focus();
      return true;
    },
  },

  // Botón ocupado mientras corre una promesa (evita doble envío)
  async busy(button, fn) {
    if (!button) return fn();
    if (button.getAttribute('aria-busy') === 'true') return undefined;
    const html = button.innerHTML;
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>${button.dataset.busyLabel || 'Guardando…'}</span>`;
    try {
      return await fn();
    } finally {
      if (document.contains(button)) {
        button.innerHTML = html;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  },

  /* ─────────────── Estados de contenido ─────────────── */
  loading(container, text = 'Cargando…') {
    if (!container) return;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = `<div class="state-g" role="status"><span class="spinner-border text-brand" aria-hidden="true"></span><p>${Utils.esc(text)}</p></div>`;
  },

  errorState(container, err, retryAction) {
    if (!container) return;
    container.removeAttribute('aria-busy');
    container.innerHTML = `
      <div class="state-g" role="alert">
        <span class="state-icon"><i class="bi bi-cloud-slash" aria-hidden="true"></i></span>
        <p class="fw-semibold text-dark mb-1">No se pudieron cargar los datos</p>
        <p>${Utils.esc(err && err.message ? err.message : 'Error desconocido.')}</p>
        ${retryAction ? `<button type="button" class="btn btn-soft" data-action="${retryAction}"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Reintentar</button>` : ''}
      </div>`;
  },

  done(container) {
    if (container) container.removeAttribute('aria-busy');
  },

  /* ─────────────── Animaciones de entrada ───────────────
   * El contenido SIEMPRE es visible por defecto. Solo se oculta brevemente para animarlo
   * si hay IntersectionObserver y el usuario no pidió reducir movimiento. Un respaldo de
   * 1,5 s lo muestra todo aunque algo falle (nunca queda "cortado"). */
  animateIn(root = document) {
    const items = root.querySelectorAll('.reveal:not(.is-in)');
    const bars = root.querySelectorAll('.bar-fill[data-value]');
    const showBar = bar => { bar.style.width = bar.dataset.value + '%'; };

    if (A11y.reducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'));
      bars.forEach(showBar);
      return;
    }

    document.documentElement.classList.add('anim-ready');
    root.querySelectorAll('.stagger').forEach(group => {
      [...group.children].forEach((child, i) => child.style.setProperty('--d', (i * 80) + 'ms'));
    });

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.classList.contains('bar-fill')) showBar(el); else el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.12 });

    items.forEach(el => io.observe(el));
    bars.forEach(el => io.observe(el));

    clearTimeout(Ui._revealTimer);
    Ui._revealTimer = setTimeout(() => {
      document.querySelectorAll('.reveal:not(.is-in)').forEach(el => el.classList.add('is-in'));
      document.querySelectorAll('.bar-fill[data-value]').forEach(showBar);
    }, 1500);
  },
};
