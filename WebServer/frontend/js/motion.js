/* ═══ motion.js — Capa de movimiento ═══
 * - Foto de fondo a página completa: la foto del hero de cada página pasa a un fondo fijo que
 *   cubre toda la ventana (con transición suave entre páginas). Se muestra siempre.
 * - Fondo vivo: la foto se desplaza con el scroll y hace un zoom lento; encima flota una red de
 *   nodos conectados que reacciona al cursor y al scroll; luz naranja que sigue al cursor.
 * - Hero: el texto se aleja al bajar y el título entra palabra por palabra.
 * - Tarjetas con inclinación 3D; tarjetas flotantes con profundidad al hacer scroll.
 * - Botones: luz bajo el cursor, efecto magnético en los principales y onda al hacer clic.
 * - Cifras que cuentan hasta su valor y filas de tabla que entran escalonadas.
 * Todo lo que se mueve se apaga si el sistema pide reducir movimiento o si el usuario activa
 * "Reducir animaciones" en Configuración (A11y.reducedMotion()). No cambia la lógica de la app:
 * solo observa el DOM que generan los módulos.
 */

const Motion = {
  on: false,
  fine: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  heroes: [],
  floats: [],
  _raf: 0,
  _queued: false,
  _tables: new WeakSet(),
  _io: null,
  _photo: '',
  _lastY: 0,

  init() {
    const bg = document.createElement('div');
    bg.className = 'mx-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML =
      '<div class="mx-ph"><i></i></div><div class="mx-ph"><i></i></div>' +
      '<div class="mx-grid"></div><span class="mx-orb o1"><i></i></span><span class="mx-orb o2"><i></i></span><span class="mx-orb o3"><i></i></span>';
    const bar = document.createElement('div');
    bar.className = 'mx-progress';
    bar.setAttribute('aria-hidden', 'true');
    const glow = document.createElement('div');
    glow.className = 'mx-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.prepend(bg, bar);
    document.body.appendChild(glow);
    Motion.bg = bg;
    Motion.glow = glow;
    Motion.photos = [...bg.querySelectorAll('.mx-ph')];
    Motion.orbs = [...bg.querySelectorAll('.mx-orb')];

    Motion.net.canvas = document.createElement('canvas');
    Motion.net.canvas.className = 'mx-net';
    Motion.net.canvas.setAttribute('aria-hidden', 'true');

    Motion.sync();
    // Reacciona si el usuario cambia "Reducir animaciones" (A11y cambia clases en <html>) o el sistema
    new MutationObserver(Motion.sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', Motion.sync);

    // Cada vez que el router o un módulo pinta contenido nuevo, se mejora lo que llegó
    new MutationObserver(Motion.schedule).observe(document.getElementById('app'), { childList: true, subtree: true });
    new MutationObserver(Motion.schedule).observe(document.getElementById('modal-root'), { childList: true, subtree: true });

    window.addEventListener('scroll', Motion.tick, { passive: true });
    window.addEventListener('resize', () => { Motion.measure(); Motion.net.resize(); Motion.tick(); }, { passive: true });
    document.addEventListener('pointerdown', Motion.ripple, { passive: true });
    if (Motion.fine) {
      document.addEventListener('pointermove', e => {
        Motion.cx = e.clientX; Motion.cy = e.clientY;
        Motion.net.mouse = { x: e.clientX, y: e.clientY };
        Motion.glow.classList.add('on');
        Motion.tick();
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => {
        Motion.glow.classList.remove('on');
        Motion.net.mouse = null;
      });
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? Motion.net.stop() : Motion.net.start()));

    Motion.schedule();

    // Precarga en segundo plano las fotos de las demás secciones (cambio instantáneo al navegar)
    const keys = ['landing', 'login', 'dashboard', 'activos', 'usuarios', 'auditoria', 'descargas', 'configuracion'];
    const preload = () => keys.forEach(k => { const u = CONFIG.images?.[k]; if (u) { const i = new Image(); i.src = u; } });
    if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 4000 }); else setTimeout(preload, 2500);
  },

  sync() {
    const want = !A11y.reducedMotion();
    if (want === Motion.on) return;
    Motion.on = want;
    document.documentElement.classList.toggle('mx-on', want);
    if (!want) { Motion.reset(); Motion.net.stop(); }
    else { Motion.net.start(); Motion.tick(); }
  },

  // Quita estilos en línea al desactivar (para que nada quede inclinado o desplazado)
  reset() {
    document.querySelectorAll('[data-mx-moved]').forEach(el => {
      el.style.removeProperty('translate');
      el.style.removeProperty('opacity');
    });
    document.querySelectorAll('.mx-tilt').forEach(el => {
      el.style.removeProperty('--mx-rx');
      el.style.removeProperty('--mx-ry');
    });
    Motion.photos?.forEach(p => { p.style.removeProperty('--mx-px'); p.style.removeProperty('--mx-py'); });
    document.querySelectorAll('.hwc').forEach(Motion.hwcClear);
  },

  schedule() {
    if (Motion._queued) return;
    Motion._queued = true;
    requestAnimationFrame(() => { Motion._queued = false; Motion.enhance(); });
  },

  /* ── Foto de fondo: cruce suave entre dos capas ── */
  setPhoto(css) {
    if (!css || css === Motion._photo) return;
    Motion._photo = css;
    const [a, b] = Motion.photos;
    const next = a.classList.contains('on') ? b : a;
    const prev = next === a ? b : a;
    const show = () => {
      if (Motion._photo !== css) return; // el usuario ya cambió de sección
      next.firstChild.style.backgroundImage = css;
      // Reinicia el zoom lento para que cada sección empiece igual
      next.firstChild.style.animation = 'none';
      void next.offsetWidth;
      next.firstChild.style.removeProperty('animation');
      next.classList.add('on');
      prev.classList.remove('on');
    };
    // Se precarga la foto para que el fundido no pase por un fondo vacío (máx. 1,2 s de espera)
    const url = (css.match(/url\(["']?(.*?)["']?\)/) || [])[1];
    if (!url) return show();
    const img = new Image();
    const t = setTimeout(show, 1200);
    img.onload = img.onerror = () => { clearTimeout(t); show(); };
    img.src = url;
  },

  // Dónde termina el hero dentro de #main: ahí el velo pasa de oscuro a claro
  measure() {
    const main = document.getElementById('main');
    const hero = main && main.querySelector(':scope > .hero-g');
    if (!hero) return;
    main.style.setProperty('--mx-he', (hero.offsetTop + hero.offsetHeight + (parseFloat(getComputedStyle(main).getPropertyValue('--nav-h')) || 68)) + 'px');
  },

  /* ── Mejora el DOM nuevo (idempotente: cada elemento se marca con data-mx) ── */
  enhance() {
    const fresh = sel => document.querySelectorAll(sel.split(',').map(x => `${x.trim()}:not([data-mx])`).join(', '));
    const mark = el => { el.dataset.mx = '1'; return el; };

    // Foto de página completa cuando la página abre con un hero
    const main = document.getElementById('main');
    const pageHero = main && main.querySelector(':scope > .hero-g');
    document.documentElement.classList.toggle('mx-full', !!pageHero);
    if (pageHero) {
      Motion.setPhoto(pageHero.style.getPropertyValue('--hero-img').trim());
      if (Motion.net.canvas.parentNode !== main) main.prepend(Motion.net.canvas);
      Motion.measure();
      if (!pageHero._mxRO && 'ResizeObserver' in window) {
        pageHero._mxRO = new ResizeObserver(() => Motion.measure());
        pageHero._mxRO.observe(pageHero);
      }
    }

    // Hero: capa de foto propia (solo se usa donde no hay foto de página completa, p. ej. login)
    fresh('.hero-g').forEach(hero => {
      mark(hero);
      const layer = document.createElement('div');
      layer.className = 'mx-hero-bg';
      layer.setAttribute('aria-hidden', 'true');
      hero.prepend(layer);
      hero.classList.add('mx-par');
      hero._mx = { mx: 0, my: 0 };
      if (Motion.fine) {
        hero.addEventListener('pointermove', e => {
          const r = hero.getBoundingClientRect();
          hero._mx.mx = (e.clientX - r.left) / r.width - .5;
          hero._mx.my = (e.clientY - r.top) / r.height - .5;
        });
        hero.addEventListener('pointerleave', () => { hero._mx.mx = hero._mx.my = 0; Motion.tick(); });
      }
    });

    // Títulos del hero: cada palabra entra por separado (el texto sigue siendo uno para lectores de pantalla)
    fresh('.hero-title, .hero-title-sm').forEach(h => {
      mark(h);
      if (!Motion.on) return;
      let i = 0;
      [...h.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(t => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            const w = document.createElement('span');
            w.className = 'mx-w';
            w.style.setProperty('--i', i++);
            w.textContent = t;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName === 'EM') {
          n.classList.add('mx-w');
          n.style.setProperty('--i', i++);
        }
      });
    });

    // Tarjetas con inclinación 3D y reflejo
    fresh('.float-card, .stat-g, .comp-g, .featured-g').forEach(card => {
      mark(card);
      card.classList.add('mx-tilt');
      const glare = document.createElement('span');
      glare.className = 'mx-glare';
      glare.setAttribute('aria-hidden', 'true');
      card.appendChild(glare);
      if (!Motion.fine) return;
      const max = card.classList.contains('featured-g') ? 4 : 7;
      card.addEventListener('pointermove', e => {
        if (!Motion.on) return;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.classList.add('mx-tracking');
        card.style.setProperty('--mx-ry', ((x - .5) * max * 2).toFixed(2) + 'deg');
        card.style.setProperty('--mx-rx', ((.5 - y) * max * 2).toFixed(2) + 'deg');
        card.style.setProperty('--mx-gx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--mx-gy', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('mx-tracking');
        card.style.setProperty('--mx-rx', '0deg');
        card.style.setProperty('--mx-ry', '0deg');
      });
    });

    // Hardware Asset Card: entrada escalonada, tilt 3D y luz especular
    fresh('.hwc').forEach(card => { mark(card); Motion.hwcBind(card); });

    // Botones: luz que sigue al cursor; los principales además son "magnéticos"
    fresh('.btn').forEach(btn => {
      mark(btn);
      if (!Motion.fine) return;
      const magnetic = btn.matches('.btn-brand, .btn-ghost-light, .btn-lg') && !btn.closest('.modal-g, .table-g, .panel-toolbar');
      btn.addEventListener('pointermove', e => {
        if (!Motion.on) return;
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--mx-bx', (e.clientX - r.left) + 'px');
        btn.style.setProperty('--mx-by', (e.clientY - r.top) + 'px');
        if (magnetic) {
          const dx = (e.clientX - r.left - r.width / 2) / r.width;
          const dy = (e.clientY - r.top - r.height / 2) / r.height;
          btn.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 8).toFixed(1)}px`;
          btn.dataset.mxMoved = '1';
        }
      });
      if (magnetic) btn.addEventListener('pointerleave', () => btn.style.removeProperty('translate'));
    });

    // Tarjetas flotantes bajo el hero: profundidad distinta al hacer scroll
    Motion.floats = [...document.querySelectorAll('.float-row .float-card')].map(c => c.parentElement);
    Motion.heroes = [...document.querySelectorAll('.hero-g.mx-par')];

    // Cifras que cuentan hasta su valor
    if (!Motion._io && 'IntersectionObserver' in window) {
      Motion._io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        Motion._io.unobserve(en.target);
        Motion.countUp(en.target);
      }), { threshold: .4 });
    }
    fresh('.stat-value, .landing-stat strong').forEach(el => {
      mark(el);
      if (Motion.on && Motion._io && Motion.parseNum(el.textContent)) Motion._io.observe(el);
    });

    // Tablas: las filas entran escalonadas la primera vez que se llenan
    document.querySelectorAll('.table-g tbody').forEach(tb => {
      if (Motion._tables.has(tb)) return;
      const rows = [...tb.rows].filter(r => !r.querySelector('.empty-g'));
      if (!rows.length) return;
      Motion._tables.add(tb);
      if (!Motion.on) return;
      rows.slice(0, 14).forEach((r, i) => {
        r.style.setProperty('--mx-i', i);
        r.classList.add('mx-row-in');
        r.addEventListener('animationend', () => r.classList.remove('mx-row-in'), { once: true });
      });
    });

    Motion.tick();
  },


  /* ── Hardware Asset Card: entrada escalonada + tilt 3D + luz especular ─────────────
   * - Entrada: un IntersectionObserver agrega .is-in la primera vez que la tarjeta se ve;
   *   el CSS escalona los elementos con --d (0 / 40 / 70–175 / 180 ms).
   * - Tilt: los eventos del puntero (pasivos) solo guardan coordenadas; un único
   *   requestAnimationFrame interpola hacia el objetivo y escribe custom properties.
   *   El rectángulo se mide al entrar (no en cada movimiento) y se corrige con el scroll,
   *   así no hay lecturas de layout dentro del bucle (cero layout thrashing).
   * - Máx. 7° de inclinación y escala 1.02; se detiene solo cuando la tarjeta queda quieta.
   */
  HWC_TILT: 7,
  HWC_SCALE: 1.02,

  hwcReveal(card) {
    if (!Motion.on || !('IntersectionObserver' in window)) { card.classList.add('is-in'); return; }
    if (!Motion._hwcIO) {
      Motion._hwcIO = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        Motion._hwcIO.unobserve(en.target);
        en.target.classList.add('is-in');
      }), { threshold: .2 });
    }
    Motion._hwcIO.observe(card);
  },

  hwcBind(card) {
    Motion.hwcReveal(card);
    if (!Motion.fine) return;                      // táctil: sin tilt (no hay "hover")
    const spot = card.querySelector('.hwc-spot');
    const st = { inside: false, px: 0, py: 0, rect: null, y0: 0, raf: 0, last: 0, rx: 0, ry: 0, s: 1, mx: 0, my: 0 };

    const step = (now) => {
      st.raf = 0;
      if (!Motion.on) { Motion.hwcClear(card); return; }
      const dt = st.last ? Math.min(64, now - st.last) : 16.7;
      st.last = now;
      let trx = 0, tryy = 0, ts = 1;
      if (st.inside && st.rect) {
        const top = st.rect.top - (window.scrollY - st.y0);   // corrige el scroll sin volver a medir
        const x = Math.min(1, Math.max(0, (st.px - st.rect.left) / st.rect.width));
        const y = Math.min(1, Math.max(0, (st.py - top) / st.rect.height));
        tryy = (x - .5) * 2 * Motion.HWC_TILT;
        trx = (.5 - y) * 2 * Motion.HWC_TILT;
        ts = Motion.HWC_SCALE;
        st.mx = x * st.rect.width; st.my = y * st.rect.height;   // la luz sigue al puntero sin inercia extra
      }
      // Interpolación amortiguada independiente de los fps (≈ ease-out exponencial)
      const k = 1 - Math.pow(1 - .16, dt / 16.7);
      st.rx += (trx - st.rx) * k; st.ry += (tryy - st.ry) * k; st.s += (ts - st.s) * k;
      card.style.setProperty('--hwc-rx', st.rx.toFixed(3) + 'deg');
      card.style.setProperty('--hwc-ry', st.ry.toFixed(3) + 'deg');
      card.style.setProperty('--hwc-s', st.s.toFixed(4));
      if (spot && st.inside) { spot.style.setProperty('--mouse-x', st.mx.toFixed(1) + 'px'); spot.style.setProperty('--mouse-y', st.my.toFixed(1) + 'px'); }
      const moving = Math.abs(trx - st.rx) > .01 || Math.abs(tryy - st.ry) > .01 || Math.abs(ts - st.s) > .0005;
      if (moving || st.inside) st.raf = requestAnimationFrame(step); else st.last = 0;
    };
    const kick = () => { if (!st.raf) st.raf = requestAnimationFrame(step); };

    card.addEventListener('pointerenter', e => {
      if (!Motion.on || e.pointerType === 'touch') return;
      st.rect = card.getBoundingClientRect(); st.y0 = window.scrollY;   // única lectura de layout
      st.inside = true; st.px = e.clientX; st.py = e.clientY;
      card.classList.add('is-hover');
      kick();
    }, { passive: true });
    card.addEventListener('pointermove', e => { if (!st.inside) return; st.px = e.clientX; st.py = e.clientY; kick(); }, { passive: true });
    card.addEventListener('pointerleave', () => {
      st.inside = false; card.classList.remove('is-hover');
      if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
      st.last = 0; kick();                                    // vuelve a reposo con la misma curva
    }, { passive: true });
  },

  hwcClear(card) {
    card.classList.remove('is-hover');
    card.classList.add('is-in');
    ['--hwc-rx', '--hwc-ry', '--hwc-s'].forEach(p => card.style.removeProperty(p));
  },

  /* "1.240", "240", "99.9%", "38" → { pre, num, dec, suf }; null si no es una cifra simple */
  parseNum(text) {
    const m = String(text).trim().match(/^([^\d]{0,3})(\d{1,3}(?:\.\d{3})+|\d+)(?:([.,])(\d+))?(\s?%?)$/);
    if (!m) return null;
    const thousands = /\./.test(m[2]) && !m[4];
    const intPart = thousands ? m[2].replace(/\./g, '') : m[2];
    return { pre: m[1], num: Number(intPart), sep: m[3] || '', dec: m[4] || '', suf: m[5] || '', thousands };
  },

  countUp(el) {
    const p = Motion.parseNum(el.textContent);
    if (!p || !Motion.on) return;
    const final = el.textContent;
    // Se escribe sobre el nodo de texto para no disparar el observador del DOM en cada cuadro
    const set = v => { if (el.firstChild && el.firstChild.nodeType === 3 && el.childNodes.length === 1) el.firstChild.data = v; else el.textContent = v; };
    const fmt = n => p.pre + (p.thousands ? n.toLocaleString('es-CL') : String(n)) + (p.dec ? p.sep + p.dec : '') + p.suf;
    const dur = 1100, t0 = performance.now();
    const step = now => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      if (k < 1) { set(fmt(Math.round(p.num * e))); requestAnimationFrame(step); }
      else {
        set(final);
        el.classList.add('mx-counted');
        el.addEventListener('animationend', () => el.classList.remove('mx-counted'), { once: true });
      }
    };
    set(fmt(0));
    requestAnimationFrame(step);
  },

  /* ── Onda al hacer clic ── */
  ripple(e) {
    if (!Motion.on || e.button > 0) return;
    const host = e.target.closest('.btn, .pill-g, .float-btn, .icon-btn-g');
    if (!host || host.disabled) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'mx-ripple';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size / 2) + 'px';
    dot.style.top = (e.clientY - r.top - size / 2) + 'px';
    host.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  },

  /* ── Scroll y cursor: un solo cuadro por evento ── */
  tick() {
    if (Motion._raf) return;
    Motion._raf = requestAnimationFrame(Motion.frame);
  },

  frame() {
    Motion._raf = 0;
    const y = window.scrollY, vh = window.innerHeight, vw = window.innerWidth;
    const dy = y - Motion._lastY;
    Motion._lastY = y;
    if (!Motion.on) return;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    document.documentElement.style.setProperty('--mx-p', Math.min(1, y / max).toFixed(4));

    // Foto de fondo: sube más lento que la página y se corre un poco hacia el cursor
    const mx = Motion.fine && Motion.cx != null ? (Motion.cx / vw - .5) : 0;
    const my = Motion.fine && Motion.cy != null ? (Motion.cy / vh - .5) : 0;
    const py = Math.max(-vh * .05, -y * .06) + my * -10;
    Motion.photos.forEach(p => {
      p.style.setProperty('--mx-px', (mx * -18).toFixed(1) + 'px');
      p.style.setProperty('--mx-py', py.toFixed(1) + 'px');
    });
    Motion.net.scroll(dy);

    // Luz del cursor
    if (Motion.cx != null) {
      Motion.glow.style.setProperty('--mx-cx', Motion.cx + 'px');
      Motion.glow.style.setProperty('--mx-cy', Motion.cy + 'px');
    }

    // Cuadrícula y luces del fondo claro (páginas sin foto)
    Motion.bg.style.setProperty('--mx-gy', (-y * .25).toFixed(1) + 'px');
    const k = [[.0011, 0, 160], [.0008, 2.1, 220], [.0014, 4.2, 140]];
    Motion.orbs.forEach((o, i) => {
      const [f, ph, amp] = k[i];
      o.style.transform = `translate3d(${(Math.cos(y * f + ph) * amp * .4).toFixed(1)}px, ${(Math.sin(y * f + ph) * amp - y * .04).toFixed(1)}px, 0)`;
    });

    // Hero: el contenido se aleja suavemente; la capa de foto propia (login) hace parallax
    Motion.heroes.forEach(hero => {
      if (!document.contains(hero)) return;
      const r = hero.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const s = Math.max(0, -r.top);
      const m = hero._mx || { mx: 0, my: 0 };
      hero.style.setProperty('--mx-hy', (s * .42 + m.my * -14).toFixed(1) + 'px');
      hero.style.setProperty('--mx-hx', (m.mx * -22).toFixed(1) + 'px');
      hero.querySelectorAll(':scope > .container-xl, :scope > .position-relative').forEach(c => {
        c.style.translate = `0 ${(s * .22).toFixed(1)}px`;
        c.style.opacity = Math.max(.2, 1 - s / (r.height * .9)).toFixed(3);
        c.dataset.mxMoved = '1';
      });
    });

    // Tarjetas flotantes: cada columna a su propia velocidad
    Motion.floats.forEach((el, i) => {
      if (!document.contains(el)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const off = (r.top + r.height / 2 - vh / 2);
      const f = [.05, .09, .065][i % 3];
      el.style.translate = `0 ${(-off * f).toFixed(1)}px`;
      el.dataset.mxMoved = '1';
    });
  },

  /* ── Red de nodos: puntos que flotan y se conectan; el scroll los arrastra y el cursor los atrae ── */
  net: {
    canvas: null, ctx: null, pts: [], running: false, raf: 0, mouse: null, w: 0, h: 0, dpr: 1,

    resize() {
      const n = Motion.net;
      if (!n.canvas) return;
      n.dpr = Math.min(1.5, window.devicePixelRatio || 1);
      n.w = window.innerWidth; n.h = window.innerHeight;
      n.canvas.width = Math.round(n.w * n.dpr);
      n.canvas.height = Math.round(n.h * n.dpr);
      n.ctx = n.canvas.getContext('2d');
      n.ctx.setTransform(n.dpr, 0, 0, n.dpr, 0, 0);
      const target = Math.min(90, Math.round(n.w * n.h / 22000));
      while (n.pts.length < target) n.pts.push({ x: Math.random() * n.w, y: Math.random() * n.h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 1 + Math.random() * 1.6, z: .4 + Math.random() * .8 });
      n.pts.length = target;
    },

    start() {
      const n = Motion.net;
      if (n.running || !Motion.on || document.hidden) return;
      if (!n.ctx) n.resize();
      n.running = true;
      const loop = () => { if (!n.running) return; n.draw(); n.raf = requestAnimationFrame(loop); };
      n.raf = requestAnimationFrame(loop);
    },

    stop() {
      const n = Motion.net;
      n.running = false;
      cancelAnimationFrame(n.raf);
      n.ctx?.clearRect(0, 0, n.w, n.h);
    },

    // Al hacer scroll los nodos se desplazan a distinta velocidad según su "profundidad"
    scroll(dy) {
      Motion.net.pts.forEach(p => { p.y -= dy * .25 * p.z; });
    },

    draw() {
      const n = Motion.net, c = n.ctx;
      if (!c || !document.documentElement.classList.contains('mx-full')) return;
      c.clearRect(0, 0, n.w, n.h);
      const pts = n.pts, L = 140, L2 = L * L, m = n.mouse;
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (m) {
          const dx = m.x - p.x, dy = m.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 32000) { p.x += dx * .006; p.y += dy * .006; }
        }
        if (p.x < -20) p.x = n.w + 20; else if (p.x > n.w + 20) p.x = -20;
        if (p.y < -20) p.y = n.h + 20; else if (p.y > n.h + 20) p.y = -20;
      }
      c.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          c.strokeStyle = `rgba(255, 138, 51, ${(.32 * (1 - d2 / L2)).toFixed(3)})`;
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        if (m) {
          const dx = a.x - m.x, dy = a.y - m.y, d2 = dx * dx + dy * dy;
          if (d2 < 32000) {
            c.strokeStyle = `rgba(255, 170, 100, ${(.45 * (1 - d2 / 32000)).toFixed(3)})`;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(m.x, m.y); c.stroke();
          }
        }
      }
      for (const p of pts) {
        c.fillStyle = `rgba(255, 160, 90, ${(.45 + p.z * .35).toFixed(2)})`;
        c.beginPath(); c.arc(p.x, p.y, p.r * p.z, 0, Math.PI * 2); c.fill();
      }
    },
  },
};

document.addEventListener('DOMContentLoaded', () => Motion.init());
