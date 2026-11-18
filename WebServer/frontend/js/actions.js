/* ═══ actions.js — Delegación de eventos (sin JavaScript en línea en el HTML) ═══
 *
 * En las plantillas se usan atributos en vez de onclick="":
 *   data-go="activos"              → navega a una ruta
 *   data-action="asset-create"     → click: ejecuta Actions.handlers['asset-create'](el, event)
 *   data-input="asset-search"      → input: mientras se escribe
 *   data-change="pref-motion"      → change: selects, checkboxes
 *   <form data-submit="login">     → submit: formularios (Enter incluido)
 *
 * Cada módulo registra sus acciones con Actions.register({ nombre: fn }).
 * Así se puede aplicar una Content-Security-Policy sin 'unsafe-inline' para scripts.
 */

const Actions = {
  handlers: {},

  register(map) {
    Object.assign(Actions.handlers, map);
  },

  run(name, el, event) {
    const fn = Actions.handlers[name];
    if (!fn) { console.warn('[Actions] Acción no registrada:', name); return; }
    try {
      const result = fn(el, event);
      if (result && typeof result.catch === 'function') result.catch(err => Ui.showError(err));
    } catch (err) {
      Ui.showError(err);
    }
  },
};

// ── Click ──
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    e.preventDefault();
    Components.closeMenus();
    Router.go(go.dataset.go);
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  if (el.tagName === 'A' && !el.hasAttribute('download')) e.preventDefault();
  Actions.run(el.dataset.action, el, e);
});

// ── Clic en el fondo oscuro de un modal (mousedown para no cerrar al soltar un arrastre) ──
document.addEventListener('mousedown', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-g') && e.target.classList.contains('open')) {
    if (e.target._onEscape) e.target._onEscape(); else Ui.closeModal(e.target.id);
  }
});

// ── Escribir ──
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el) Actions.run(el.dataset.input, el, e);
});

// ── Cambios ──
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) Actions.run(el.dataset.change, el, e);
});

// ── Envío de formularios ──
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-submit]');
  if (!form) return;
  e.preventDefault();
  Actions.run(form.dataset.submit, form, e);
});

// ── Teclado global ──
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // 1) modal abierto
  const top = Ui._modalStack[Ui._modalStack.length - 1];
  if (top) {
    e.preventDefault();
    if (top.modal._onEscape) top.modal._onEscape(); else Ui.closeModal(top.id);
    return;
  }
  // 2) menús del navbar
  Components.closeMenus(true);
});

// ── Acciones globales ──
Actions.register({
  'modal-close': (el) => {
    const modal = el.closest('.modal-g');
    if (!modal) return;
    if (modal._onEscape) modal._onEscape(); else Ui.closeModal(modal.id);
  },
  'skip-to-content': () => {
    const main = document.getElementById('main');
    if (main) { main.setAttribute('tabindex', '-1'); main.focus(); }
  },
  'toggle-menu': () => Components.toggleMenu(),
  'toggle-profile': () => Components.toggleProfile(),
  'logout': async () => {
    Components.closeMenus();
    await Auth.logout();
    Ui.notify('Sesión cerrada.', 'info');
    Router.go('login');
  },
  'scroll-to': (el) => {
    const target = document.getElementById(el.dataset.target);
    if (!target) return;
    target.scrollIntoView({ behavior: A11y.reducedMotion() ? 'auto' : 'smooth' });
    const focusable = target.querySelector('h2, h3') || target;
    focusable.setAttribute('tabindex', '-1');
    focusable.focus({ preventScroll: true });
  },
});
