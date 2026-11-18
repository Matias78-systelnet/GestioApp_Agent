/* ═══ router.js — Navegación SPA por hash (#/ruta) ═══
 * - Protege rutas privadas (sin sesión → login) y por permiso (sin permiso → primera ruta permitida).
 * - Tras cada navegación: foco en el <h1> y anuncio del título para lectores de pantalla.
 * Funciona abriendo app.html directo (file://) o servido por cualquier servidor estático.
 * La portada pública (#/landing) redirige a index.html, el recorrido con el notebook real.
 */

const Router = {
  current: null,
  _first: true,

  init() {
    window.addEventListener('hashchange', () => Router.go(Router.parse()));
    if (Auth.isLoggedIn()) Auth.startTimeout();
    Router.go(Router.parse());
  },

  parse() {
    return location.hash.replace(/^#\/?/, '') || 'landing';
  },

  resolve(page) {
    if (!ROUTES[page]) page = 'landing';
    const logged = Auth.isLoggedIn();
    if (!ROUTES[page].public && !logged) return 'login';
    if (ROUTES[page].public && logged) return Auth.firstAllowedRoute();
    if (!Auth.canView(page)) {
      Ui.notify('No tiene permisos para ver esa sección.', 'warning');
      return Auth.firstAllowedRoute();
    }
    return page;
  },

  go(requested) {
    const page = Router.resolve(requested);
    // La portada pública es el recorrido de index.html; el panel vive en app.html
    if (page === 'landing') { location.replace('index.html'); return; }
    const target = '#/' + page;
    if (location.hash !== target) {
      // Redirecciones no dejan una entrada extra en el historial
      if (page !== requested) history.replaceState(null, '', target);
      else location.hash = target;
    }
    Router.render(page);
  },

  render(page) {
    if (Router.current === page) return;
    Router.current = page;

    const route = ROUTES[page];
    const mod = Pages[page];
    const app = document.getElementById('app');
    document.title = `${route.title} — ${CONFIG.app.name}`;

    Ui.clearModals();
    if (route.public) {
      app.innerHTML = mod.template();
    } else {
      app.innerHTML = Components.appLayout(page);
      document.getElementById('main').innerHTML = mod.template();
    }
    Ui.mountModals(app);
    Components.applyBackgrounds(app);
    window.scrollTo(0, 0);
    Ui.animateIn(app);

    // En la primera carga no se roba el foco; al navegar sí (para teclado y lectores)
    if (!Router._first) A11y.focusPage(route.title);
    Router._first = false;

    if (mod.init) {
      Promise.resolve()
        .then(() => mod.init())
        .then(() => Ui.animateIn(app))
        .catch(err => Ui.showError(err));
    }
  },
};
