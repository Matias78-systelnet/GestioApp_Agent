/* ═══ services/http-client.js — Cliente HTTP para el backend real ═══
 * Todas las llamadas pasan por Http.call(nombreEndpoint, params, body, query).
 * Los endpoints se definen en CONFIG.api.endpoints ("MÉTODO /ruta/:param").
 * Formato de error esperado del backend (ver docs/API.md):
 *   { "message": "Texto para el usuario", "code": "VALIDATION_ERROR", "errors": { "campo": "mensaje" } }
 */

class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', fieldErrors = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;          // código HTTP (0 = sin conexión / timeout)
    this.code = code;
    this.fieldErrors = fieldErrors; // { campo: 'mensaje' } para mostrar junto a cada input
    this.details = details;
  }
}

const Http = {
  defaultMessage(status) {
    if (status === 0) return 'No hay conexión con el servidor. Revise su red e inténtelo de nuevo.';
    if (status === 401) return 'Su sesión expiró. Inicie sesión nuevamente.';
    if (status === 403) return 'No tiene permisos para realizar esta acción.';
    if (status === 404) return 'El recurso solicitado no existe.';
    if (status === 409) return 'La operación entra en conflicto con datos existentes.';
    if (status === 422 || status === 400) return 'Revise los datos ingresados.';
    return 'Ocurrió un error en el servidor. Inténtelo de nuevo en unos minutos.';
  },

  // "PUT /assets/:id" + { id: 5 } → { method: 'PUT', path: '/assets/5' }
  resolve(name, params = {}) {
    const spec = CONFIG.api.endpoints[name];
    if (!spec) throw new Error(`Endpoint no configurado: ${name}`);
    const [method, rawPath] = spec.trim().split(/\s+/);
    const path = rawPath.replace(/:(\w+)/g, (_, key) => {
      if (params[key] === undefined || params[key] === null) throw new Error(`Falta el parámetro :${key} para ${name}`);
      return encodeURIComponent(params[key]);
    });
    return { method: method.toUpperCase(), path };
  },

  async call(name, params = {}, body = undefined, query = undefined) {
    const { method, path } = Http.resolve(name, params || {});
    return Http.request(method, path, { body, query });
  },

  async request(method, path, { body, query } = {}) {
    const base = CONFIG.api.baseUrl.replace(/\/$/, '');
    const qs = query
      ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = Auth.getToken();
    if (token && !CONFIG.api.withCredentials) headers[CONFIG.auth.tokenHeader] = CONFIG.auth.tokenPrefix + token;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.api.timeoutMs);

    let response;
    try {
      response = await fetch(base + path + (qs.length > 1 ? qs : ''), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: CONFIG.api.withCredentials ? 'include' : 'same-origin',
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const timeout = err && err.name === 'AbortError';
      throw new ApiError(timeout ? 'El servidor tardó demasiado en responder. Inténtelo de nuevo.' : Http.defaultMessage(0), { status: 0, code: timeout ? 'TIMEOUT' : 'NETWORK' });
    }
    clearTimeout(timer);

    if (response.status === 204) return null;

    let data = null;
    const text = await response.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }

    if (!response.ok) {
      const error = new ApiError((data && data.message) || Http.defaultMessage(response.status), {
        status: response.status,
        code: (data && data.code) || 'HTTP_' + response.status,
        fieldErrors: (data && data.errors) || null,
        details: data,
      });
      // 401 en cualquier llamada que no sea el login → sesión inválida
      if (response.status === 401 && path !== Http.resolve('login').path) Auth.handleUnauthorized();
      throw error;
    }
    return data;
  },
};
