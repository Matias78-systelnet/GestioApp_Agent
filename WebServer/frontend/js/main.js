/* ═══ main.js — Arranque de la aplicación ═══ */

A11y.applyPrefs();

document.addEventListener('DOMContentLoaded', () => {
  if (CONFIG.api.mode === 'mock') {
    console.info(`[${CONFIG.app.name}] Modo demostración: los datos se guardan en este navegador. Cambie CONFIG.api.mode a 'http' para usar el backend.`);
  }
  Router.init();
});
