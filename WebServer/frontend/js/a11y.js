/* ═══ a11y.js — Utilidades de accesibilidad ═══
 * - announce(): avisos para lectores de pantalla (regiones aria-live en app.html)
 * - trapFocus(): mantiene el foco dentro de un modal
 * - focusPage(): mueve el foco al título al cambiar de página
 * - prefs: preferencias del usuario (reducir animaciones)
 */

const A11y = {
  FOCUSABLE: 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  PREFS_KEY: 'gestio_prefs',

  // Anuncia un mensaje. assertive = interrumpe (errores); polite = espera (confirmaciones)
  announce(message, assertive = false) {
    const region = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
    if (!region) return;
    region.textContent = '';
    // pequeño retraso para que el lector detecte el cambio aunque el texto se repita
    setTimeout(() => { region.textContent = message; }, 60);
  },

  focusables(container) {
    return [...container.querySelectorAll(A11y.FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
  },

  // Devuelve una función para liberar el foco
  trapFocus(container) {
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = A11y.focusables(container);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', onKey);
    return () => container.removeEventListener('keydown', onKey);
  },

  // Tras navegar: foco en el <h1> de la página y anuncio del título
  focusPage(title) {
    const heading = document.querySelector('#main h1, #main [data-page-title]') || document.getElementById('main');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    A11y.announce('Página: ' + title);
  },

  // ── Preferencias de accesibilidad (se guardan en este navegador) ──
  getPrefs() {
    return { reduceMotion: false, ...Utils.load(A11y.PREFS_KEY, {}) };
  },

  setPref(key, value) {
    const prefs = { ...A11y.getPrefs(), [key]: value };
    Utils.store(A11y.PREFS_KEY, prefs);
    A11y.applyPrefs();
  },

  applyPrefs() {
    const p = A11y.getPrefs();
    document.documentElement.classList.toggle('pref-reduce-motion', !!p.reduceMotion);
  },

  reducedMotion() {
    return A11y.getPrefs().reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
};
