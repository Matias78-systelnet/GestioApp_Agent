/* ═══ assets.js — Módulo de Activos ═══
 * Datos: Api.assets.* y Api.users.list() (para asignar). Filtro, búsqueda y orden en el cliente.
 * Si el inventario crece mucho, mover filtro/orden/paginación al backend (ver docs/API.md → query params).
 */

const Assets = {
  items: [],
  users: [],
  selectedId: null,
  editingId: null,
  filter: 'all',
  typeFilter: 'all',   // categoría: 'all' | valor de CONFIG.catalogs.assetTypes
  search: '',
  sortCol: null,
  sortAsc: true,

  COLUMNS: [
    { key: 'name', label: 'Activo', sortable: true },
    { key: 'type', label: 'Tipo', sortable: true },
    { key: 'serial', label: 'N° de serie', sortable: false },
    { key: 'status', label: 'Estado', sortable: true },
    { key: 'assignedTo', label: 'Responsable', sortable: true },
    { key: 'location', label: 'Ubicación', sortable: true },
  ],

  get selected() {
    return Assets.items.find(a => Utils.sameId(a.id, Assets.selectedId)) || null;
  },

  // ══════════ Plantilla ══════════
  template() {
    const canWrite = Auth.can('assets.write');
    const canAssign = Auth.can('assets.assign');
    const typeOpts = CONFIG.catalogs.assetTypes.map(t => ({ value: t.value, label: t.label }));

    return `
    ${Components.pageHero({
      eyebrow: 'Inventario', title: 'Activos', accent: 'bajo control', image: 'activos',
      subtitle: 'Cargando inventario…', subtitleId: 'assets-count',
      actions: `
        ${canWrite ? `<button type="button" class="btn btn-brand" data-action="asset-new">${Components.icon('bi-plus-lg')} Añadir equipo</button>` : ''}
        ${CONFIG.features.csvExport ? `<button type="button" class="btn btn-ghost-light" data-action="asset-export">${Components.icon('bi-filetype-csv')} Exportar CSV</button>` : ''}`,
    })}
    <div class="container-xl page-body">
      <section class="panel-g reveal" aria-labelledby="assets-table-title">
        <h2 id="assets-table-title" class="visually-hidden">Listado de activos</h2>
        <div class="panel-toolbar">
          <div class="d-flex flex-column flex-sm-row gap-2 flex-grow-1">
            <div class="search-g" role="search">
              <label for="asset-search" class="visually-hidden">Buscar activos por nombre, serie, responsable o ubicación</label>
              ${Components.icon('bi-search')}
              <input type="search" id="asset-search" class="form-control input-g" placeholder="Buscar por nombre, serie, responsable…" data-input="asset-search" autocomplete="off">
            </div>
            <div class="pills-g" role="group" aria-label="Filtrar por estado">
              <button type="button" class="pill-g" data-action="asset-filter" data-filter="all" aria-pressed="true">Todos</button>
              <button type="button" class="pill-g" data-action="asset-filter" data-filter="Asignado" aria-pressed="false">Asignados</button>
              <button type="button" class="pill-g" data-action="asset-filter" data-filter="Disponible" aria-pressed="false">Disponibles</button>
            </div>
            <div class="type-filter-g">
              <label for="asset-type-filter" class="visually-hidden">Filtrar por categoría</label>
              <select id="asset-type-filter" class="form-select input-g" data-change="asset-type-filter">
                <option value="all">Todas las categorías</option>
                ${typeOpts.map(o => `<option value="${Utils.esc(o.value)}">${Utils.esc(o.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          ${canWrite || canAssign ? `
          <div class="d-flex flex-wrap align-items-center gap-2" role="group" aria-label="Acciones sobre el activo seleccionado">
            <span class="selection-hint" id="asset-selection" aria-live="polite">Seleccione un activo de la tabla</span>
            ${canWrite && Api.mode !== 'http' ? `<button type="button" class="btn btn-soft btn-sm need-sel" data-action="asset-edit" disabled>${Components.icon('bi-pencil')} Modificar</button>` : ''}
            ${canAssign && Api.mode !== 'http' ? `<button type="button" class="btn btn-soft btn-sm need-sel" data-action="asset-assign" disabled>${Components.icon('bi-link-45deg')} Asignar</button>` : ''}
            ${canWrite ? `<button type="button" class="btn btn-danger-soft btn-sm need-sel" data-action="asset-delete" disabled>${Components.icon('bi-trash3')} ${Api.mode === 'http' ? 'Revocar acceso' : 'Eliminar'}</button>` : ''}
          </div>` : ''}
          ${canWrite && Api.mode === 'http' ? '<button type="button" class="btn btn-soft btn-sm need-sel" data-action="asset-renew-code" disabled>Nuevo código</button>' : ''}
        </div>

        <div id="assets-state"></div>
        <div class="table-responsive" id="assets-table-wrap" role="region" aria-labelledby="assets-table-title" tabindex="0" hidden>
          <table class="table-g">
            <caption class="visually-hidden">Activos registrados. ${canWrite || canAssign ? 'Use la primera columna para seleccionar un activo.' : ''}</caption>
            <thead><tr>
              ${canWrite || canAssign ? '<th scope="col" class="sel-col"><span class="visually-hidden">Seleccionar</span></th>' : ''}
              ${Assets.COLUMNS.map(c => `
                <th scope="col" data-col="${c.key}"${c.sortable ? ' aria-sort="none"' : ''}>
                  ${c.sortable
                    ? `<button type="button" class="sort-btn" data-action="asset-sort" data-col="${c.key}">${c.label} ${Components.icon('bi-arrow-down-up', 'sort-arrow')}</button>`
                    : c.label}
                </th>`).join('')}
              <th scope="col" class="text-end">Ficha</th>
            </tr></thead>
            <tbody id="assets-tbody"></tbody>
          </table>
        </div>
      </section>
    </div>

    ${Components.modal('modal-asset', '<span id="asset-form-title">Registrar activo</span>', `
      <form id="asset-form" data-submit="asset-save" novalidate>
        ${Components.formIntro()}
        ${Components.field({ id: 'asset-name', name: 'name', label: 'Nombre del activo', placeholder: 'Ej: Notebook Dell Latitude 5540', required: true })}
        <div class="row g-3">
          <div class="col-sm-6">${Components.selectField({ id: 'asset-type', name: 'type', label: 'Tipo', options: typeOpts, required: true })}</div>
          <div class="col-sm-6">${Components.field({ id: 'asset-serial', name: 'serial', label: 'N° de serie', placeholder: 'DL5540-2024-001', required: true, cls: 'mono' })}</div>
        </div>
        <div class="row g-3">
          <div class="col-sm-6">${Components.field({ id: 'asset-value', name: 'value', label: 'Valor estimado', placeholder: '850000', inputmode: 'numeric', hint: 'En pesos, solo números.' })}</div>
          <div class="col-sm-6">${Components.selectField({ id: 'asset-location', name: 'location', label: 'Ubicación', options: CONFIG.catalogs.locations, required: true })}</div>
        </div>
      </form>`,
      `<button type="button" class="btn btn-soft" data-action="modal-close">Cancelar</button>
       <button type="submit" class="btn btn-brand" form="asset-form" id="asset-submit">Registrar activo</button>`)}

    ${Components.modal('modal-enrollment-code', 'Código de vinculación', `
      <p>Copie este código e introdúzcalo en el instalador de GestioApp del equipo indicado.</p>
      <p id="enrollment-code-name"></p>
      <label for="enrollment-code-value">Código de un solo uso</label>
      <input id="enrollment-code-value" class="form-control input-g mono" readonly autocomplete="off">
      <p id="enrollment-code-expiry" class="mt-3"></p>
      <p>Se muestra solo ahora. Si lo pierde, seleccione el equipo pendiente y pulse «Nuevo código».</p>`,
      '<button type="button" class="btn btn-brand" data-action="enrollment-copy">Copiar código</button><button type="button" class="btn btn-soft" data-action="modal-close">Cerrar</button>')}

    ${Components.modal('modal-assign' , 'Asignar activo', `
      <form id="assign-form" data-submit="asset-assign-save" novalidate>
        <p class="info-g" id="assign-info"></p>
        ${Components.selectField({ id: 'assign-user', name: 'userId', label: 'Usuario responsable', options: [], hint: 'Elija "Sin asignar" para dejar el activo disponible.' })}
      </form>`,
      `<button type="button" class="btn btn-soft" data-action="modal-close">Cancelar</button>
       <button type="submit" class="btn btn-brand" form="assign-form">Confirmar asignación</button>`)}

    ${Components.modal('modal-asset-detail', '<span id="asset-detail-name">Ficha técnica</span>',
      '<div id="asset-detail-body" class="sheet-g"></div>',
      '<button type="button" class="btn btn-soft" data-action="modal-close">Cerrar</button>')}`;
  },

  // ══════════ Datos ══════════
  async init() {
    Object.assign(Assets, { items: [], users: [], selectedId: null, filter: 'all', typeFilter: 'all', search: '', sortCol: null, sortAsc: true });
    await Assets.load();
  },

  async load() {
    const state = document.getElementById('assets-state');
    const wrap = document.getElementById('assets-table-wrap');
    wrap.hidden = true;
    Ui.loading(state, 'Cargando activos…');
    try {
      const needUsers = Auth.can('assets.assign');
      const [assetsRes, usersRes] = await Promise.all([
        Api.assets.list(),
        needUsers ? Api.users.list() : Promise.resolve({ items: [] }),
      ]);
      Assets.items = assetsRes.items || [];
      Assets.users = usersRes.items || [];
      if (Assets.selectedId && !Assets.selected) Assets.selectedId = null;
      state.innerHTML = '';
      Ui.done(state);
      Assets.render();
    } catch (err) {
      Ui.errorState(state, err, 'asset-reload');
    }
  },

  responsibleName(a) {
    return a.assignedTo && a.assignedTo.name ? a.assignedTo.name : '';
  },

  getFiltered() {
    let list = Assets.filter === 'all' ? [...Assets.items] : Assets.items.filter(a => a.status === Assets.filter);
    if (Assets.typeFilter !== 'all') list = list.filter(a => a.type === Assets.typeFilter);
    const q = Assets.search.trim().toLowerCase();
    if (q) {
      list = list.filter(a => [a.name, a.serial, a.assetTag, a.id, a.brand, a.model, a.condition, a.specs && a.specs.cpu,
        Assets.responsibleName(a), a.location, Utils.assetType(a.type).label]
        .some(v => String(v ?? '').toLowerCase().includes(q)));
    }
    if (Assets.sortCol) {
      const val = a => String(Assets.sortCol === 'assignedTo' ? Assets.responsibleName(a)
        : Assets.sortCol === 'type' ? Utils.assetType(a.type).label : a[Assets.sortCol] || '').toLowerCase();
      list.sort((a, b) => {
        const cmp = val(a).localeCompare(val(b), CONFIG.app.locale);
        return Assets.sortAsc ? cmp : -cmp;
      });
    }
    return list;
  },

  // ══════════ Render ══════════
  render() {
    const filtered = Assets.getFiltered();
    const canSelect = Auth.can('assets.write') || Auth.can('assets.assign');
    const count = document.getElementById('assets-count');
    if (count) count.textContent = `${Assets.items.length} registrados · ${filtered.length} mostrados`;

    document.querySelectorAll('[data-action="asset-filter"]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === Assets.filter));
    });
    document.querySelectorAll('#assets-table-wrap th[data-col]').forEach(th => {
      if (!th.hasAttribute('aria-sort')) return;
      const active = th.dataset.col === Assets.sortCol;
      th.setAttribute('aria-sort', active ? (Assets.sortAsc ? 'ascending' : 'descending') : 'none');
      const icon = th.querySelector('.sort-arrow');
      if (icon) icon.className = 'bi sort-arrow ' + (active ? (Assets.sortAsc ? 'bi-caret-up-fill' : 'bi-caret-down-fill') : 'bi-arrow-down-up');
    });

    const wrap = document.getElementById('assets-table-wrap');
    const state = document.getElementById('assets-state');
    const tbody = document.getElementById('assets-tbody');
    if (!tbody) return;

    if (!Assets.items.length) {
      wrap.hidden = true;
      state.innerHTML = Components.empty(Auth.can('assets.write')
        ? 'Aún no hay activos. Registre el primero con "Nuevo activo".'
        : 'Aún no hay activos registrados.');
      Assets.updateSelectionUI();
      return;
    }
    state.innerHTML = '';
    wrap.hidden = false;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="${Assets.COLUMNS.length + 1 + (canSelect ? 1 : 0)}" class="empty-g">No hay activos que coincidan. Pruebe otra búsqueda o cambie el filtro.</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(a => {
        const type = Utils.assetType(a.type);
        const resp = Assets.responsibleName(a);
        const id = Utils.esc(a.id);
        return `<tr data-id="${id}"${canSelect ? ' data-action="asset-row"' : ''}>
          ${canSelect ? `<td class="sel-col"><input type="radio" class="form-check-input radio-g" name="asset-sel" id="asset-sel-${id}" value="${id}" data-change="asset-radio" aria-label="Seleccionar ${Utils.esc(a.name)}"></td>` : ''}
          <th scope="row"><span class="d-flex align-items-center gap-3 fw-semibold text-dark text-nowrap">
            <span class="type-icon">${Components.icon(type.icon)}</span>${Utils.esc(a.name)}</span></th>
          <td class="text-secondary text-nowrap">${Utils.esc(type.label)}</td>
          <td class="mono small text-secondary text-nowrap">${Utils.esc(a.serial)}</td>
          <td>${Components.assetBadges(a)}</td>
          <td class="text-nowrap">${resp ? Utils.esc(resp) : '<span class="text-secondary">Sin asignar</span>'}</td>
          <td class="text-secondary text-nowrap">${Utils.esc(a.location)}</td>
          <td class="text-end"><button type="button" class="btn btn-soft btn-sm btn-sheet" data-action="asset-detail" data-id="${id}"
            aria-label="Ver ficha técnica de ${Utils.esc(a.name)}, serie ${Utils.esc(a.serial)}" aria-haspopup="dialog">${Components.icon('bi-card-list')}<span class="d-none d-xl-inline"> Ver ficha</span></button></td>
        </tr>`;
      }).join('');
    }
    Assets.updateSelectionUI();
  },

  // Actualiza la selección SIN volver a dibujar la tabla (conserva el foco del teclado)
  updateSelectionUI() {
    const sel = Assets.selected;
    document.querySelectorAll('#assets-tbody tr[data-id]').forEach(tr => {
      const on = sel && Utils.sameId(tr.dataset.id, sel.id);
      tr.classList.toggle('row-selected', !!on);
      const radio = tr.querySelector('input[type="radio"]');
      if (radio) radio.checked = !!on;
    });
    const hint = document.getElementById('asset-selection');
    if (hint) {
      hint.textContent = sel ? 'Seleccionado: ' + sel.name : 'Seleccione un activo de la tabla';
      hint.classList.toggle('active', !!sel);
    }
    document.querySelectorAll('#main .need-sel').forEach(b => { b.disabled = !sel; });
    if (Api.mode === 'http') {
      const renew = document.querySelector('[data-action="asset-renew-code"]');
      if (renew) renew.disabled = !sel || sel.enrollmentStatus !== 'pending';
      const revoke = document.querySelector('[data-action="asset-delete"]');
      if (revoke) revoke.disabled = !sel?.managedEnrollment || sel.enrollmentStatus === 'revoked';
    }
  },

  openDetail(id) {
    const a = Assets.items.find(x => Utils.sameId(x.id, id));
    if (!a) return;
    document.getElementById('asset-detail-name').textContent = 'Ficha técnica · ' + a.name;
    document.getElementById('asset-detail-body').innerHTML = a.specs ? Components.hardwareCard(a, { uid: 'detail' }) : Components.specSheet(a);
    Ui.openModal('modal-asset-detail');
  },

  select(id, toggle = false) {
    Assets.selectedId = toggle && Utils.sameId(Assets.selectedId, id) ? null : id;
    Assets.updateSelectionUI();
  },

  announceResults: Utils.debounce(() => {
    const n = Assets.getFiltered().length;
    A11y.announce(n === 1 ? '1 activo encontrado.' : `${n} activos encontrados.`);
  }, 700),

  // ══════════ Acciones ══════════
  openForm(mode) {
    const form = document.getElementById('asset-form');
    Ui.form.reset(form);
    if (Api.mode === 'http') {
      form.querySelectorAll('.row').forEach(row => { row.hidden = true; row.style.display = 'none'; });
      form.querySelectorAll('input,select').forEach(input => {
        if (input.name && input.name !== 'name') input.disabled = true;
      });
    }
    const isEdit = mode === 'edit';
    Assets.editingId = isEdit ? Assets.selected.id : null;
    document.getElementById('asset-form-title').textContent = isEdit ? 'Modificar activo' : 'Registrar activo';
    const submit = document.getElementById('asset-submit');
    submit.textContent = isEdit ? 'Guardar cambios' : 'Registrar activo';
    if (isEdit) {
      const a = Assets.selected;
      Ui.form.fill(form, { name: a.name, type: a.type, serial: a.serial, value: a.value ?? '', location: a.location });
    }
    Ui.openModal('modal-asset');
  },

  async save(form) {
    const raw = Ui.form.read(form);
    const data = { ...raw, value: Utils.parseMoney(raw.value) };
    const errors = Api.mode === 'http' ? (!data.name?.trim() ? { name: 'Ingrese el nombre del equipo.' } : {}) : Validators.asset(data, Assets.items, Assets.editingId);
    if (Object.keys(errors).length) { Ui.form.setErrors(form, errors); return; }

    const isEdit = Assets.editingId !== null;
    await Ui.busy(document.getElementById('asset-submit'), async () => {
      try {
        let receipt;
        if (isEdit) await Api.assets.update(Assets.editingId, data);
        else receipt = await Api.assets.create(Api.mode === 'http' ? { name: data.name } : data);
        Ui.closeModal('modal-asset');
        Ui.notify(isEdit ? 'Activo modificado.' : 'Equipo registrado.');
        if (receipt?.enrollmentCode) Assets.showCode(receipt);
        await Assets.load();
      } catch (err) {
        Ui.showError(err, form);
      }
    });
  },

  openAssign() {
    const a = Assets.selected;
    if (!a) return;
    const select = document.getElementById('assign-user');
    const active = Assets.users.filter(u => u.status === 'active');
    select.innerHTML = '<option value="">Sin asignar (dejar disponible)</option>'
      + active.map(u => `<option value="${Utils.esc(u.id)}">${Utils.esc(u.name)} · ${Utils.esc(u.area)}</option>`).join('');
    select.value = a.assignedTo && a.assignedTo.id != null ? String(a.assignedTo.id) : '';
    document.getElementById('assign-info').textContent = `Activo: ${a.name} (${a.serial}).`;
    Ui.form.clearErrors(document.getElementById('assign-form'));
    Ui.openModal('modal-assign');
  },

  async saveAssign(form) {
    const a = Assets.selected;
    if (!a) return;
    const { userId } = Ui.form.read(form);
    const user = Assets.users.find(u => Utils.sameId(u.id, userId));
    const btn = document.querySelector('[form="assign-form"][type="submit"]');
    await Ui.busy(btn, async () => {
      try {
        await Api.assets.assign(a.id, userId === '' ? null : (user ? user.id : userId));
        Ui.closeModal('modal-assign');
        Ui.notify(user ? `Activo asignado a ${user.name}.` : 'Activo marcado como disponible.');
        await Assets.load();
      } catch (err) {
        Ui.showError(err, form);
      }
    });
  },

  showCode(receipt) {
    document.getElementById('enrollment-code-name').textContent = 'Equipo: ' + receipt.name;
    document.getElementById('enrollment-code-value').value = receipt.enrollmentCode;
    document.getElementById('enrollment-code-expiry').textContent = 'Vence: ' + new Date(receipt.expires_at).toLocaleString();
    Ui.openModal('modal-enrollment-code');
  },
  async renewCode() {
    if (!Assets.selected || Assets.selected.enrollmentStatus !== 'pending') return;
    try { Assets.showCode(await Api.assets.renewCode(Assets.selected.id)); await Assets.load(); }
    catch (err) { Ui.showError(err); }
  },
  async copyCode() {
    const field = document.getElementById('enrollment-code-value');
    try { await navigator.clipboard.writeText(field.value); Ui.notify('Código copiado.'); }
    catch { field.focus(); field.select(); Ui.notify('Presione Ctrl+C para copiar el código.'); }
  },
  async remove() {
    const a = Assets.selected;
    if (!a) return;
    const ok = await Ui.confirm({
      title: Api.mode === 'http' ? 'Revocar acceso' : 'Eliminar activo',
      message: Api.mode === 'http' ? `Se anulará el código o credencial de "${a.name}". Se conserva su historial.` : `Se eliminará "${a.name}".`,
      confirmText: Api.mode === 'http' ? 'Revocar acceso' : 'Eliminar activo',
      danger: true,
    });
    if (!ok) return;
    try {
      await Api.assets.remove(a.id);
      Assets.selectedId = null;
      Ui.notify(Api.mode === 'http' ? 'Acceso revocado.' : 'Activo eliminado.');
      await Assets.load();
      document.getElementById('asset-search')?.focus();
    } catch (err) {
      Ui.showError(err);
    }
  },

  exportCSV() {
    const data = Assets.getFiltered();
    if (!data.length) { Ui.notify('No hay activos para exportar con el filtro actual.', 'warning'); return; }
    Utils.downloadCSV(
      `activos_${CONFIG.app.name.toLowerCase()}_${Utils.todayStamp()}.csv`,
      ['Nombre', 'Tipo', 'N° Serie', 'Estado', 'Responsable', 'Ubicación', 'Valor (CLP)'],
      data.map(a => [a.name, Utils.assetType(a.type).label, a.serial, a.status, Assets.responsibleName(a) || '—', a.location, a.value ?? '']),
    );
    Api.track('Exportó listado de activos (CSV)', 'info');
    Ui.notify(`CSV descargado con ${data.length} activos.`);
  },
};

Actions.register({
  'asset-reload': () => Assets.load(),
  'asset-renew-code': () => Assets.renewCode(),
  'enrollment-copy': () => Assets.copyCode(),
  'asset-new': () => Assets.openForm('new'),
  'asset-edit': () => Assets.selected && Assets.openForm('edit'),
  'asset-assign': () => Assets.openAssign(),
  'asset-delete': () => Assets.remove(),
  'asset-export': () => Assets.exportCSV(),
  'asset-save': (form) => Assets.save(form),
  'asset-assign-save': (form) => Assets.saveAssign(form),
  // Clic en la fila (mouse): alterna. Clic/teclas en el radio: selecciona.
  'asset-row': (tr, e) => {
    const onRadio = e.target.matches('input[type="radio"]');
    Assets.select(tr.dataset.id, !onRadio);
  },
  'asset-radio': (radio) => Assets.select(radio.value),
  // El botón vive dentro de la fila, pero la delegación toma el [data-action] más cercano: no alterna la selección
  'asset-detail': (btn) => Assets.openDetail(btn.dataset.id),
  'asset-type-filter': (select) => {
    Assets.typeFilter = select.value;
    Assets.render();
    Assets.announceResults();
  },
  'asset-filter': (btn) => {
    Assets.filter = btn.dataset.filter;
    Assets.render();
    Assets.announceResults();
  },
  'asset-search': (input) => {
    Assets.search = input.value;
    Assets.render();
    Assets.announceResults();
  },
  'asset-sort': (btn) => {
    const col = btn.dataset.col;
    if (Assets.sortCol === col) Assets.sortAsc = !Assets.sortAsc;
    else { Assets.sortCol = col; Assets.sortAsc = true; }
    Assets.render();
  },
});
