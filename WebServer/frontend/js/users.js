/* ═══ users.js — Módulo de Usuarios ═══
 * Datos: Api.users.*. Reglas como "no eliminar al último administrador" se validan
 * aquí para dar aviso inmediato, pero el backend DEBE aplicarlas (responde 409).
 */

const Users = {
  items: [],
  selectedId: null,
  editingId: null,

  get selected() {
    return Users.items.find(u => Utils.sameId(u.id, Users.selectedId)) || null;
  },

  // ══════════ Plantilla ══════════
  template() {
    const canWrite = Auth.can('users.write');
    return `
    ${Components.pageHero({
      eyebrow: 'Accesos', title: 'Usuarios', accent: 'y permisos', image: 'usuarios',
      subtitle: 'Cargando usuarios…', subtitleId: 'users-count',
      actions: canWrite ? `<button type="button" class="btn btn-brand" data-action="user-new">${Components.icon('bi-person-plus')} Nuevo usuario</button>` : '',
    })}
    <div class="container-xl page-body">
      <section class="panel-g reveal" aria-labelledby="users-table-title">
        <h2 id="users-table-title" class="visually-hidden">Listado de usuarios</h2>
        ${canWrite ? `
        <div class="panel-toolbar">
          <span class="selection-hint" id="user-selection" aria-live="polite">Seleccione un usuario para modificarlo o eliminarlo</span>
          <div class="d-flex gap-2" role="group" aria-label="Acciones sobre el usuario seleccionado">
            <button type="button" class="btn btn-soft btn-sm need-sel" data-action="user-edit" disabled>${Components.icon('bi-pencil')} Modificar</button>
            <button type="button" class="btn btn-danger-soft btn-sm need-sel" data-action="user-delete" disabled>${Components.icon('bi-trash3')} Eliminar</button>
          </div>
        </div>` : ''}
        <div id="users-state"></div>
        <div class="table-responsive" id="users-table-wrap" role="region" aria-labelledby="users-table-title" tabindex="0" hidden>
          <table class="table-g table-users">
            <caption class="visually-hidden">Usuarios de la plataforma, primero los activos.</caption>
            <thead><tr>
              ${canWrite ? '<th scope="col" class="sel-col"><span class="visually-hidden">Seleccionar</span></th>' : ''}
              <th scope="col">Nombre</th>
              <th scope="col">Rol</th>
              <th scope="col">Área</th>
              <th scope="col" class="text-center">Activos</th>
              <th scope="col">Acceso y conexión</th>
              <th scope="col">Estado</th>
              <th scope="col">Respaldos</th>
              <th scope="col"><span class="visually-hidden">Habilitar o deshabilitar</span></th>
            </tr></thead>
            <tbody id="users-tbody"></tbody>
          </table>
        </div>
      </section>
    </div>

    ${Components.modal('modal-user', '<span id="user-form-title">Crear usuario</span>', `
      <form id="user-form" data-submit="user-save" novalidate>
        ${Components.formIntro()}
        ${Components.field({ id: 'user-name', name: 'name', label: 'Nombre completo', placeholder: 'Nombre Apellido', required: true, autocomplete: 'name' })}
        ${Components.field({ id: 'user-rut', name: 'rut', label: 'RUT', placeholder: '12.345.678-5', required: true, hint: 'Con o sin puntos, con guion y dígito verificador.' })}
        ${Components.field({ id: 'user-email', name: 'email', label: 'Email corporativo', type: 'email', placeholder: 'nombre@empresa.cl', required: true, autocomplete: 'email' })}
        <div class="row g-3">
          <div class="col-sm-6">${Components.field({ id: 'user-password', name: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••', required: true, autocomplete: 'new-password', hint: `Mínimo ${CONFIG.auth.minPasswordLength} caracteres.` })}</div>
          <div class="col-sm-6">${Components.field({ id: 'user-password2', name: 'passwordConfirm', label: 'Confirmar contraseña', type: 'password', placeholder: '••••••••', required: true, autocomplete: 'new-password' })}</div>
        </div>
        <div class="row g-3">
          <div class="col-sm-6">${Components.selectField({ id: 'user-role', name: 'role', label: 'Rol', options: CONFIG.catalogs.roles, required: true })}</div>
          <div class="col-sm-6">${Components.selectField({ id: 'user-area', name: 'area', label: 'Área', options: CONFIG.catalogs.areas, required: true })}</div>
        </div>
      </form>`,
      `<button type="button" class="btn btn-soft" data-action="modal-close">Cancelar</button>
       <button type="submit" class="btn btn-brand" form="user-form" id="user-submit">Crear usuario</button>`)}

    ${Components.modal('modal-backup', '<span id="backup-title">Respaldos</span>', '<div id="backup-body"></div>', '', 'modal-lg-g')}`;
  },

  // ══════════ Datos ══════════
  async init() {
    Object.assign(Users, { items: [], selectedId: null, editingId: null });
    await Users.load();
  },

  async load() {
    const state = document.getElementById('users-state');
    document.getElementById('users-table-wrap').hidden = true;
    Ui.loading(state, 'Cargando usuarios…');
    try {
      const res = await Api.users.list();
      Users.items = res.items || [];
      if (Users.selectedId && !Users.selected) Users.selectedId = null;
      state.innerHTML = '';
      Ui.done(state);
      Users.render();
    } catch (err) {
      Ui.errorState(state, err, 'user-reload');
    }
  },

  // ══════════ Render ══════════
  render() {
    const canWrite = Auth.can('users.write');
    const me = Auth.getUser();
    const active = Users.items.filter(u => u.status === 'active');
    const disabled = Users.items.filter(u => u.status !== 'active');
    const count = document.getElementById('users-count');
    if (count) count.textContent = `${active.length} activos · ${disabled.length} deshabilitados`;

    const wrap = document.getElementById('users-table-wrap');
    const state = document.getElementById('users-state');
    if (!Users.items.length) {
      wrap.hidden = true;
      state.innerHTML = Components.empty('Aún no hay usuarios. Cree el primero con "Nuevo usuario".');
      return;
    }
    wrap.hidden = false;

    const roleType = r => (r === 'Administrador' ? 'pri' : r === 'Supervisor' ? 'dark' : 'default');
    document.getElementById('users-tbody').innerHTML = [...active, ...disabled].map(u => {
      const id = Utils.esc(u.id);
      const isDis = u.status !== 'active';
      const isMe = me && Utils.sameId(me.id, u.id);
      const toggle = !canWrite || isMe
        ? ''
        : isDis
          ? `<button type="button" class="btn btn-success-soft btn-sm" data-action="user-enable" data-id="${id}">${Components.icon('bi-person-check')} Habilitar<span class="visually-hidden"> a ${Utils.esc(u.name)}</span></button>`
          : `<button type="button" class="btn btn-danger-soft btn-sm" data-action="user-disable" data-id="${id}">Deshabilitar<span class="visually-hidden"> a ${Utils.esc(u.name)}</span></button>`;
      return `<tr data-id="${id}" class="${isDis ? 'row-disabled' : ''}"${canWrite ? ' data-action="user-row"' : ''}>
        ${canWrite ? `<td class="sel-col"><input type="radio" class="form-check-input radio-g" name="user-sel" value="${id}" data-change="user-radio" aria-label="Seleccionar ${Utils.esc(u.name)}"></td>` : ''}
        <th scope="row">
          <span class="d-flex align-items-center gap-3">
            <span class="avatar-g ${isDis ? 'muted' : 'dark'}" aria-hidden="true">${Utils.esc(Utils.initials(u.name))}</span>
            <span class="lh-sm fw-normal">
              <strong class="d-block text-dark">${Utils.esc(u.name)}${isMe ? ' <span class="small text-secondary fw-normal">(usted)</span>' : ''}</strong>
              <small class="text-secondary">${Utils.esc(u.email)} · <span class="mono">${Utils.esc(u.rut || '')}</span></small>
            </span>
          </span>
        </th>
        <td>${Components.badge(u.role, roleType(u.role))}</td>
        <td class="text-secondary">${Utils.esc(u.area)}</td>
        <td class="text-center mono fw-semibold">${Utils.esc(u.assetCount ?? 0)}</td>
        <td class="text-nowrap lh-sm">
          <span class="mono small text-secondary d-block">${u.lastAccess ? Utils.esc(Utils.formatRelative(u.lastAccess)) : 'Nunca'}</span>
          <small class="text-dark fw-semibold">${Components.icon('bi-clock-history')} Prom. ${Utils.esc(Users.avgText(u.avgConnectionMin))}</small>
        </td>
        <td>${isDis ? Components.badge('Deshabilitado', 'red', true) : Components.badge('Activo', 'grn', true)}</td>
        <td class="text-nowrap">
          ${!isDis ? `<button type="button" class="btn btn-soft btn-sm" data-action="user-backups" data-id="${id}">${Components.icon('bi-cloud')} Respaldos<span class="visually-hidden"> de ${Utils.esc(u.name)}</span></button>` : ''}
        </td>
        <td class="text-nowrap text-end">${toggle}</td>
      </tr>`;
    }).join('');
    Users.updateSelectionUI();
  },

  // 380 → "6 h 20 min/día" ; null → "sin datos"
  avgText(min) {
    if (min === null || min === undefined || isNaN(min)) return 'sin datos';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return (h ? h + ' h ' : '') + (m || !h ? m + ' min' : '').trim() + '/día';
  },

  updateSelectionUI() {
    const sel = Users.selected;
    document.querySelectorAll('#users-tbody tr[data-id]').forEach(tr => {
      const on = sel && Utils.sameId(tr.dataset.id, sel.id);
      tr.classList.toggle('row-selected', !!on);
      const radio = tr.querySelector('input[type="radio"]');
      if (radio) radio.checked = !!on;
    });
    const hint = document.getElementById('user-selection');
    if (hint) {
      hint.textContent = sel ? 'Seleccionado: ' + sel.name : 'Seleccione un usuario para modificarlo o eliminarlo';
      hint.classList.toggle('active', !!sel);
    }
    document.querySelectorAll('#main .need-sel').forEach(b => { b.disabled = !sel; });
  },

  select(id, toggle = false) {
    Users.selectedId = toggle && Utils.sameId(Users.selectedId, id) ? null : id;
    Users.updateSelectionUI();
  },

  lastActiveAdmin(u) {
    return u.role === 'Administrador' && u.status === 'active'
      && Users.items.filter(x => x.role === 'Administrador' && x.status === 'active').length <= 1;
  },

  // ══════════ Acciones ══════════
  openForm(mode) {
    const form = document.getElementById('user-form');
    Ui.form.reset(form);
    const isEdit = mode === 'edit';
    Users.editingId = isEdit ? Users.selected.id : null;
    document.getElementById('user-form-title').textContent = isEdit ? 'Modificar usuario' : 'Crear usuario';
    document.getElementById('user-submit').textContent = isEdit ? 'Guardar cambios' : 'Crear usuario';
    // Al crear la contraseña es obligatoria; al modificar, en blanco conserva la actual.
    ['user-password', 'user-password2'].forEach(id => {
      const input = document.getElementById(id);
      input.required = !isEdit;
      input.setAttribute('aria-required', String(!isEdit));
      const req = form.querySelector(`label[for="${id}"] .req`);
      if (req) req.hidden = isEdit;
    });
    document.getElementById('user-password-hint').textContent = `${isEdit ? 'Déjela en blanco para mantener la actual. ' : ''}Mínimo ${CONFIG.auth.minPasswordLength} caracteres y al menos 3 grupos: mayúsculas, minúsculas, números y símbolos.`;
    if (isEdit) {
      const u = Users.selected;
      Ui.form.fill(form, { name: u.name, rut: u.rut, email: u.email, role: u.role, area: u.area });
    }
    Ui.openModal('modal-user');
  },

  async save(form) {
    const { passwordConfirm, ...data } = Ui.form.read(form);
    // Las contraseñas se leen sin recortar espacios.
    const password = document.getElementById('user-password').value;
    const confirm = document.getElementById('user-password2').value;
    const { errors, rut } = Validators.user(data, Users.items, Users.editingId);
    const current = Users.editingId !== null ? Users.selected : null;
    if (current && Users.lastActiveAdmin(current) && data.role !== 'Administrador') {
      errors.role = 'Debe quedar al menos un administrador activo.';
    }
    const min = CONFIG.auth.minPasswordLength;
    if (!current || password || confirm) {
      if (!password) errors.password = 'Ingrese una contraseña.';
      else if (password.length < min) errors.password = `La contraseña debe tener al menos ${min} caracteres.`;
      else if (!Validators.passwordComplexity(password)) errors.password = 'La contraseña debe incluir caracteres de al menos 3 de estos 4 grupos: mayúsculas, minúsculas, números y símbolos.';
      else if (Validators.passwordContainsAccountOrName(password, data.email, data.name)) errors.password = 'La contraseña no puede contener el nombre de cuenta ni partes del nombre personal de 3 o más caracteres.';
      if (!confirm) errors.passwordConfirm = 'Repita la contraseña.';
      else if (password && confirm !== password) errors.passwordConfirm = 'Las contraseñas no coinciden.';
    }
    if (Object.keys(errors).length) { Ui.form.setErrors(form, errors); return; }

    const payload = { ...data, rut };
    if (password) payload.password = password;
    else delete payload.password;
    await Ui.busy(document.getElementById('user-submit'), async () => {
      try {
        if (current) await Api.users.update(current.id, payload);
        else await Api.users.create(payload);
        Ui.closeModal('modal-user');
        Ui.notify(current ? 'Usuario modificado.' : 'Usuario creado.');
        await Users.load();
      } catch (err) {
        Ui.showError(err, form);
      }
    });
  },

  async remove() {
    const u = Users.selected;
    if (!u) return;
    if (Users.lastActiveAdmin(u)) { Ui.notify('No puede eliminar al último administrador.', 'error'); return; }
    const ok = await Ui.confirm({
      title: 'Eliminar usuario',
      message: `Se eliminará a ${u.name}. Sus activos quedarán disponibles. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar usuario',
      danger: true,
    });
    if (!ok) return;
    try {
      await Api.users.remove(u.id);
      Users.selectedId = null;
      Ui.notify('Usuario eliminado.');
      await Users.load();
    } catch (err) {
      Ui.showError(err);
    }
  },

  async setStatus(id, status) {
    const u = Users.items.find(x => Utils.sameId(x.id, id));
    if (!u) return;
    if (status === 'disabled') {
      if (Users.lastActiveAdmin(u)) { Ui.notify('No puede deshabilitar al último administrador.', 'error'); return; }
      const ok = await Ui.confirm({
        title: 'Deshabilitar cuenta',
        message: `${u.name} no podrá iniciar sesión hasta que se habilite nuevamente. Sus datos se conservan.`,
        confirmText: 'Deshabilitar cuenta',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await Api.users.setStatus(u.id, status);
      Ui.notify(status === 'disabled' ? `Cuenta de ${u.name} deshabilitada.` : `Cuenta de ${u.name} habilitada.`);
      await Users.load();
      document.querySelector(`#users-tbody tr[data-id="${CSS.escape(String(u.id))}"] button`)?.focus();
    } catch (err) {
      Ui.showError(err);
    }
  },

  async openBackups(id) {
    const u = Users.items.find(x => Utils.sameId(x.id, id));
    if (!u) return;
    document.getElementById('backup-title').textContent = 'Respaldos de ' + u.name;
    const body = document.getElementById('backup-body');
    Ui.loading(body, 'Cargando respaldos…');
    Ui.openModal('modal-backup', '.modal-x');
    try {
      const b = await Api.users.backups(u.id);
      Ui.done(body);
      body.innerHTML = `
        <div class="backup-banner">
          <span aria-hidden="true">${Components.icon(b.active ? 'bi-cloud-check' : 'bi-cloud-slash')}</span>
          <div>
            <strong>${b.active ? 'Respaldo automático activo' : 'Respaldo automático detenido'}</strong>
            <small>Cada ${Utils.esc(b.intervalMin || 30)} min · Último: ${Utils.esc(Utils.formatRelative(b.lastRun, true))} · Próximo: ${Utils.esc(Utils.formatRelative(b.nextRun, true))}</small>
          </div>
        </div>
        <h3 class="label-g mt-3 mb-2">Carpetas respaldadas</h3>
        <ul class="row g-2 list-unstyled mb-3">
          ${(b.folders || []).map(f => `<li class="col-sm-4"><div class="folder-g"><strong>${Components.icon('bi-folder2')} ${Utils.esc(f.name)}</strong><small>${Utils.esc(f.files)} archivos · ${Utils.esc(f.size)}</small></div></li>`).join('')}
        </ul>
        <h3 class="label-g mb-2" id="backup-files-title">Últimos archivos respaldados</h3>
        <div class="table-responsive border rounded-3" role="region" aria-labelledby="backup-files-title" tabindex="0">
          <table class="table-g table-sm-g table-backups">
            <thead><tr><th scope="col">Archivo</th><th scope="col">Carpeta</th><th scope="col">Tamaño</th><th scope="col">Modificado</th><th scope="col" class="text-center">Descargar</th></tr></thead>
            <tbody>
              ${(b.files || []).map(f => `<tr>
                <th scope="row" class="fw-semibold text-dark">${Utils.esc(f.name)}</th>
                <td class="text-secondary">${Utils.esc(f.folder)}</td>
                <td class="mono text-nowrap">${Utils.esc(f.size)}</td>
                <td class="mono text-secondary text-nowrap">${Utils.esc(Utils.formatRelative(f.modifiedAt, true))}</td>
                <td class="text-center text-nowrap">
                  ${Utils.safeUrl(f.url)
                    ? `<a class="icon-btn-g" href="${Utils.esc(Utils.safeUrl(f.url))}" download>${Components.icon('bi-download')}<span class="visually-hidden">Descargar ${Utils.esc(f.name)}</span></a>`
                    : `<button type="button" class="icon-btn-g" data-action="backup-file" data-name="${Utils.esc(f.name)}">${Components.icon('bi-download')}<span class="visually-hidden">Descargar ${Utils.esc(f.name)}</span></button>`}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      Ui.errorState(body, err);
    }
  },
};

Actions.register({
  'user-reload': () => Users.load(),
  'user-new': () => Users.openForm('new'),
  'user-edit': () => Users.selected && Users.openForm('edit'),
  'user-delete': () => Users.remove(),
  'user-save': (form) => Users.save(form),
  'user-row': (tr, e) => Users.select(tr.dataset.id, !e.target.matches('input[type="radio"]')),
  'user-radio': (radio) => Users.select(radio.value),
  'user-disable': (btn) => Users.setStatus(btn.dataset.id, 'disabled'),
  'user-enable': (btn) => Users.setStatus(btn.dataset.id, 'active'),
  'user-backups': (btn) => Users.openBackups(btn.dataset.id),
  'backup-file': (btn) => Ui.notify(`Descarga simulada: ${btn.dataset.name}. En producción el backend entrega la URL del archivo.`, 'info'),
});
