/* ═══ utils.js — Funciones puras compartidas (sin DOM de la app) ═══ */

const Utils = {
  // ── Storage seguro (puede fallar en modo privado o con storage bloqueado) ──
  store(key, data, storage = localStorage) {
    try { storage.setItem(key, JSON.stringify(data)); } catch { /* ignorado */ }
  },

  load(key, fallback = null, storage = localStorage) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  remove(key, storage = localStorage) {
    try { storage.removeItem(key); } catch { /* ignorado */ }
  },

  // ── Escapar texto antes de insertarlo como HTML (OBLIGATORIO para datos del backend) ──
  esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // ── Solo URLs http(s), mailto o relativas (bloquea "javascript:" venido de datos) ──
  safeUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (/^(https?:|mailto:|\/|\.\/|#)/i.test(s)) return s;
    return /^[a-z][a-z0-9+.-]*:/i.test(s) ? '' : s;
  },

  // ── Iniciales para avatares ──
  initials(name = '') {
    return String(name).split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';
  },

  pct(part, total) {
    return total ? Math.round(part / total * 100) : 0;
  },

  sameId(a, b) {
    return a != null && b != null && String(a) === String(b);
  },

  debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // ── Fechas: el backend entrega ISO 8601; se muestran en formato local ──
  toDate(value) {
    if (!value) return null;
    // 'AAAA-MM-DD' (sin hora) se interpreta como fecha local: new Date('2027-04-10') sería UTC y en Chile mostraría el día anterior
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const d = day ? new Date(+day[1], day[2] - 1, +day[3]) : new Date(value);
    return isNaN(d) ? null : d;
  },

  formatDate(value) {
    const d = Utils.toDate(value);
    return d ? d.toLocaleDateString(CONFIG.app.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  },

  formatTime(value, seconds = false, hour12 = false) {
    const d = Utils.toDate(value);
    if (d && hour12) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return d ? d.toLocaleTimeString(CONFIG.app.locale, { hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, hour12: false }) : '';
  },

  // "Hoy 08:32" / "Ayer 17:45" / "12/09/2026 10:00". Textos no ISO se muestran tal cual.
  formatRelative(value, hour12 = false) {
    const d = Utils.toDate(value);
    if (!d) return value ? String(value) : '—';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    const time = Utils.formatTime(d, false, hour12);
    if (diff === 0) return 'Hoy ' + time;
    if (diff === 1) return 'Ayer ' + time;
    return Utils.formatDate(d) + ' ' + time;
  },

  // ── Moneda ──
  formatMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (isNaN(n)) return String(value);
    return new Intl.NumberFormat(CONFIG.app.locale, { style: 'currency', currency: CONFIG.app.currency, maximumFractionDigits: 0 }).format(n);
  },

  // "$850.000" | "850000" → 850000 ; vacío → null
  parseMoney(text) {
    if (text === null || text === undefined) return null;
    if (typeof text === 'number') return text;
    const digits = String(text).replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  },

  // ── CSV (BOM UTF-8 para que Excel respete tildes) ──
  downloadCSV(filename, headers, rows) {
    const sep = CONFIG.features.csvSeparator;
    const cell = v => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // evita que Excel ejecute fórmulas (=, +, -, @) venidas de los datos
      return /["\n\r]/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = '﻿' + [headers, ...rows].map(r => r.map(cell).join(sep)).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  todayStamp() {
    const d = new Date();
    return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map(n => String(n).padStart(2, '0')).join('-');
  },

  // ── Catálogos ──
  assetType(value) {
    return CONFIG.catalogs.assetTypes.find(t => t.value === value) || { value, label: value || '—', icon: 'bi-box' };
  },
};
