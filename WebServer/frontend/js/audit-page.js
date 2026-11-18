/* ═══ audit-page.js — Módulo de Auditoría ═══
 * Datos: Api.audit.list({ type, limit, offset }) → { items, total }
 * El filtro por tipo y la paginación se piden al backend.
 */

const AuditPage = {
  filter: null,
  items: [],
  total: 0,

  // Ícono según el verbo del mensaje (solo visual)
  icon(e) {
    const t = e.message || '';
    if (/^Descarg/.test(t)) return 'bi-download';
    if (/^Consult/.test(t)) return 'bi-eye';
    if (/^Export/.test(t)) return 'bi-filetype-csv';
    if (/sesión|^Accedi/.test(t)) return 'bi-box-arrow-in-right';
    if (/^Asign|^Desasign/.test(t)) return 'bi-link-45deg';
    if (/^Deshabilit/.test(t)) return 'bi-person-x';
    if (e.type === 'success') return 'bi-plus-circle';
    if (e.type === 'danger') return 'bi-trash3';
    if (e.type === 'warn') return 'bi-exclamation-triangle';
    return 'bi-pencil';
  },

  typeInfo(type) {
    return CONFIG.catalogs.auditTypes[type] || CONFIG.catalogs.auditTypes.info;
  },

  template() {
    const types = CONFIG.catalogs.auditTypes;
    return `
    ${Components.pageHero({ eyebrow: 'Trazabilidad', title: 'Auditoría', accent: 'de accesos', image: 'auditoria', subtitle: 'Cargando registros…', subtitleId: 'audit-count' })}
    <div class="container-xl page-body">
      <section class="panel-g reveal" aria-labelledby="audit-list-title">
        <h2 id="audit-list-title" class="visually-hidden">Registro de auditoría</h2>
        <div class="panel-toolbar">
          <div class="pills-g" role="group" aria-label="Filtrar por tipo de acción">
            <button type="button" class="pill-g" data-action="audit-filter" data-filter="" aria-pressed="true">Todos</button>
            ${Object.entries(types).map(([k, t]) => `<button type="button" class="pill-g" data-action="audit-filter" data-filter="${k}" aria-pressed="false">${Utils.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div id="audit-list"></div>
        <div class="text-center p-3" id="audit-more-wrap" hidden>
          <button type="button" class="btn btn-soft" data-action="audit-more" id="audit-more">Cargar más registros</button>
        </div>
      </section>
    </div>`;
  },

  async init() {
    AuditPage.filter = null;
    await AuditPage.load(true);
  },

  async load(reset = false) {
    const list = document.getElementById('audit-list');
    if (reset) {
      AuditPage.items = [];
      Ui.loading(list, 'Cargando registros…');
    }
    try {
      const res = await Api.audit.list({ type: AuditPage.filter || undefined, limit: CONFIG.features.auditPageSize, offset: AuditPage.items.length });
      AuditPage.items = AuditPage.items.concat(res.items || []);
      AuditPage.total = res.total ?? AuditPage.items.length;
      Ui.done(list);
      AuditPage.render(reset ? 0 : AuditPage.items.length - (res.items || []).length);
    } catch (err) {
      Ui.errorState(list, err, 'audit-reload');
    }
  },

  render(focusFrom = 0) {
    const count = document.getElementById('audit-count');
    if (count) count.textContent = `${AuditPage.items.length} de ${AuditPage.total} registros${AuditPage.filter ? ' (' + AuditPage.typeInfo(AuditPage.filter).label.toLowerCase() + ')' : ''}`;
    document.querySelectorAll('[data-action="audit-filter"]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.filter || null) === AuditPage.filter)));

    const list = document.getElementById('audit-list');
    const moreWrap = document.getElementById('audit-more-wrap');
    moreWrap.hidden = AuditPage.items.length >= AuditPage.total;

    if (!AuditPage.items.length) {
      list.innerHTML = Components.empty(AuditPage.filter
        ? 'No hay registros de este tipo. Elija otro filtro.'
        : 'Aún no hay registros. Cada acción en el panel quedará anotada aquí.');
      return;
    }

    list.innerHTML = `<ol class="audit-list-g">${AuditPage.items.map((e, i) => {
      const t = AuditPage.typeInfo(e.type);
      return `
      <li class="audit-row-g"${i === focusFrom && focusFrom > 0 ? ' tabindex="-1" id="audit-first-new"' : ''}>
        <time class="audit-stamp mono" datetime="${Utils.esc(e.timestamp)}">${Utils.esc(Utils.formatDate(e.timestamp))} · ${Utils.esc(Utils.formatTime(e.timestamp, true))}</time>
        <span class="tl-icon">${Components.icon(AuditPage.icon(e))}</span>
        <span class="audit-type">${Components.badge(t.label, t.badge)}</span>
        <span class="audit-text">${Utils.esc(e.message)}${e.actor && e.actor.name ? `<small class="audit-actor">por ${Utils.esc(e.actor.name)}</small>` : ''}</span>
      </li>`;
    }).join('')}</ol>`;

    // Tras "Cargar más", el foco va al primer registro nuevo
    const firstNew = document.getElementById('audit-first-new');
    if (firstNew) firstNew.focus();
  },
};

Actions.register({
  'audit-reload': () => AuditPage.load(true),
  'audit-filter': (btn) => {
    AuditPage.filter = btn.dataset.filter || null;
    AuditPage.load(true).then(() => A11y.announce(`${AuditPage.total} registros encontrados.`));
  },
  'audit-more': (btn) => Ui.busy(btn, () => AuditPage.load(false)),
});
