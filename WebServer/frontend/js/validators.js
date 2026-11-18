/* ═══ validators.js — Validaciones de formularios ═══
 * Devuelven { campo: 'mensaje' }. Objeto vacío = válido.
 * El backend DEBE repetir estas validaciones: las del frontend son solo para la experiencia de uso.
 */

const Validators = {
  // ── RUT chileno (módulo 11) ──
  rut(rut) {
    if (!rut) return { ok: false, msg: 'Ingrese el RUT.' };
    const clean = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (clean.length < 2) return { ok: false, msg: 'El RUT es muy corto.' };

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    if (!/^\d+$/.test(body)) return { ok: false, msg: 'El RUT solo puede tener números y el dígito verificador.' };

    let sum = 0;
    let mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const expected = 11 - (sum % 11);
    const dvExpected = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);

    if (dv !== dvExpected) {
      return { ok: false, msg: `El dígito verificador no coincide (debería ser ${dvExpected}).` };
    }
    return { ok: true, formatted: body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv };
  },

  email(email) {
    if (!email) return { ok: false, msg: 'Ingrese el email.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, msg: 'Use un email válido, por ejemplo nombre@empresa.cl.' };
    return { ok: true };
  },

  passwordComplexity(password) {
    const groups = [/\p{Lu}/u, /\p{Ll}/u, /\p{N}/u, /[^\p{L}\p{N}]/u];
    return groups.filter(pattern => pattern.test(password)).length >= 3;
  },

  passwordContainsAccountOrName(password, email, fullName) {
    const username = String(email).split('@')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]/g, '.').replace(/^[._-]+|[._-]+$/g, '').slice(0, 20).toLowerCase();
    const blockedParts = [username, ...String(fullName).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u)]
      .filter(part => part.length >= 3);
    const normalizedPassword = password.toLocaleLowerCase();
    return blockedParts.some(part => normalizedPassword.includes(part));
  },

  // ── Activo ── existing = lista actual para detectar serie duplicada
  asset(data, existing = [], excludeId = null) {
    const errors = {};
    if (!data.name) errors.name = 'Ingrese el nombre del activo.';
    if (!data.serial) {
      errors.serial = 'Ingrese el número de serie.';
    } else if (existing.some(a => !Utils.sameId(a.id, excludeId) && String(a.serial).toLowerCase() === data.serial.toLowerCase())) {
      errors.serial = 'Ya existe un activo con ese número de serie.';
    }
    if (!CONFIG.catalogs.assetTypes.some(t => t.value === data.type)) errors.type = 'Elija un tipo de la lista.';
    if (!CONFIG.catalogs.locations.includes(data.location)) errors.location = 'Elija una ubicación de la lista.';
    if (data.value !== null && data.value !== undefined && (isNaN(data.value) || data.value < 0)) errors.value = 'Ingrese un valor numérico, por ejemplo 850000.';
    return errors;
  },

  // ── Usuario ── devuelve { errors, rut } donde rut es el RUT normalizado (o null)
  user(data, existing = [], excludeId = null) {
    const errors = {};
    if (!data.name) errors.name = 'Ingrese el nombre completo.';

    const rut = Validators.rut(data.rut);
    if (!rut.ok) errors.rut = rut.msg;

    const email = Validators.email(data.email);
    if (!email.ok) errors.email = email.msg;

    const others = existing.filter(u => !Utils.sameId(u.id, excludeId));
    if (email.ok && others.some(u => String(u.email).toLowerCase() === data.email.toLowerCase())) {
      errors.email = 'Ya existe un usuario con ese email.';
    }
    if (rut.ok && others.some(u => u.rut === rut.formatted)) {
      errors.rut = 'Ya existe un usuario con ese RUT.';
    }
    if (!CONFIG.catalogs.roles.includes(data.role)) errors.role = 'Elija un rol de la lista.';
    if (!CONFIG.catalogs.areas.includes(data.area)) errors.area = 'Elija un área de la lista.';

    return { errors, rut: rut.ok ? rut.formatted : null };
  },
};
