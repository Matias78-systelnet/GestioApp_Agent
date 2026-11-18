# Contrato de API — GestioApp

Este documento define lo que el frontend espera del backend. El adaptador `js/services/mock-adapter.js`
implementa este mismo contrato sobre `localStorage`: sirve como **referencia ejecutable** (misma forma de
respuestas, mismas validaciones, mismos códigos de error).

- Rutas configurables en `js/config.js → CONFIG.api.endpoints` (si el backend usa otras rutas, solo se cambia ahí).
- URL base en `CONFIG.api.baseUrl` (por defecto `/api/v1`).

---

## 1. Convenciones generales

| Tema | Regla |
|---|---|
| Formato | JSON en cuerpo y respuesta. `Content-Type: application/json`. |
| Fechas | ISO 8601 con zona horaria (`2026-09-27T13:11:55.000Z`). El frontend las muestra en hora local `es-CL`. |
| IDs | Número o texto (UUID). El frontend los trata como opacos. |
| Dinero | Número entero en pesos (CLP), sin formato: `850000`. |
| Listas | Siempre `{ "items": [...], "total": N }`. |
| Sin contenido | `204 No Content` (por ejemplo, en DELETE). |
| Autenticación | Por defecto `Authorization: Bearer <token>`. Si `CONFIG.api.withCredentials = true`, se envían cookies (`credentials: 'include'`) y no se manda el header. |
| CORS | Si el frontend y la API están en dominios distintos, permitir el origen del frontend, los métodos `GET, POST, PUT, PATCH, DELETE` y los headers `Authorization, Content-Type`. |

### Formato de error (todas las rutas)

```json
{
  "message": "Revise los datos ingresados.",
  "code": "VALIDATION_ERROR",
  "errors": { "serial": "Ya existe un activo con ese número de serie." }
}
```

- `message` se muestra tal cual al usuario: redactarlo en español, claro y diciendo cómo resolverlo.
- `errors` (opcional) se muestra **junto a cada campo** del formulario. Las claves deben ser los nombres
  de campo de este documento (`name`, `serial`, `rut`, `email`…).

| Código HTTP | Uso | Qué hace el frontend |
|---|---|---|
| 400 / 422 | Datos inválidos | Muestra `errors` junto a los campos o `message`. |
| 401 | Sin sesión o token vencido | Cierra la sesión, vuelve al login y avisa. (En `/auth/login`: credenciales incorrectas). |
| 403 | Sin permiso, o cuenta deshabilitada en el login | Muestra `message`. |
| 404 | Recurso inexistente | Muestra `message`. |
| 409 | Conflicto de reglas de negocio (ej.: último administrador) | Muestra `message`. |
| 5xx / sin red / timeout | Error de servidor o red | Muestra un estado de error con botón **Reintentar**. |

---

## 2. Modelos

### Usuario de sesión (`SessionUser`)
```json
{ "id": 4, "name": "Admin Rodrigo", "email": "admin@empresa.cl", "role": "Administrador", "area": "Informática" }
```
`role` debe ser uno de `CONFIG.catalogs.roles` (`Usuario`, `Supervisor`, `Administrador`). Los permisos de cada
rol están en `CONFIG.permissions` y **el backend debe aplicar los mismos**.

### Usuario (`User`)
```json
{
  "id": 1, "name": "María González", "rut": "12.345.678-5", "email": "m.gonzalez@empresa.cl",
  "role": "Usuario", "area": "RRHH", "status": "active", "assetCount": 1,
  "lastAccess": "2026-09-27T11:32:00.000Z",
  "avgConnectionMin": 380
}
```
- `status`: `"active"` | `"disabled"`.
- `rut`: formato `12.345.678-5` (el frontend lo envía ya normalizado).
- `lastAccess`: ISO o `null` si nunca ingresó.
- `avgConnectionMin`: promedio diario de conexión en minutos (entero) o `null` si aún no hay datos (lo calcula el backend con los reportes del agente).

### Activo (`Asset`)
```json
{
  "id": 1, "name": "Notebook Dell Latitude 5540", "type": "Notebook", "serial": "DL5540-2024-001",
  "status": "Asignado", "location": "Casa Matriz", "value": 850000,
  "assignedTo": { "id": 1, "name": "María González" }
}
```
- `type`: uno de `CONFIG.catalogs.assetTypes[].value` (`Notebook`, `PC`).
- `location`: uno de `CONFIG.catalogs.locations`.
- `status`: `"Asignado"` si `assignedTo` no es `null`, si no `"Disponible"` (lo calcula el backend).

### Evento de auditoría (`AuditEvent`)
```json
{
  "id": "e-123", "timestamp": "2026-09-27T13:11:55.000Z", "type": "info",
  "message": "Asignó \"Notebook Lenovo ThinkPad T14\" a Carlos Muñoz",
  "actor": { "id": 4, "name": "Admin Rodrigo" }
}
```
- `type`: `success` (creación) · `info` (modificación/consulta) · `danger` (eliminación) · `warn` (advertencia).
- **El backend registra la auditoría** de cada operación que modifique datos y del login. El frontend
  solo envía eventos que ocurren en el navegador (ver `POST /audit/events`).

---

## 3. Endpoints

### Autenticación

#### `POST /auth/login`
```json
// petición
{ "email": "admin@empresa.cl", "password": "••••••" }
// 200
{ "token": "eyJhbGciOi...", "user": { /* SessionUser */ } }
```
Errores: `401` credenciales incorrectas · `403` cuenta deshabilitada (`code: "ACCOUNT_DISABLED"`).
Con sesión por cookie, `token` puede venir vacío y la cookie `HttpOnly` se envía en la respuesta.
Debe registrar en auditoría "Inició sesión en el panel" y actualizar `lastAccess`.

#### `POST /auth/logout` → `204`
Invalida el token o la cookie. El frontend cierra la sesión local aunque esta llamada falle.

#### `GET /auth/me` → `200 SessionUser`
Disponible para revalidar la sesión (el frontend actual no la usa al arrancar).

### Dashboard

#### `GET /dashboard/summary` → `200`
```json
{
  "assets": { "total": 8, "assigned": 6, "available": 2, "byType": { "Notebook": 5, "PC": 3 }, "locations": ["Casa Matriz", "Bodega", "Sucursal 2", "Sucursal 3"] },
  "users": { "active": 4, "disabled": 0, "withTwoFactor": 4 },
  "audit": { "total": 42, "latest": { /* AuditEvent | null */ } },
  "featuredAsset": { /* Asset | null */ },
  "recentActivity": [ /* AuditEvent[], los 7 más recientes (CONFIG.features.timelineSize) */ ]
}
```

### Activos

| Método y ruta | Permiso | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /assets` | `assets.view` | — | `200 { items: Asset[], total }` |
| `POST /assets` | `assets.write` | `AssetInput` | `201 Asset` |
| `PUT /assets/:id` | `assets.write` | `AssetInput` | `200 Asset` |
| `DELETE /assets/:id` | `assets.write` | — | `204` |
| `PUT /assets/:id/assignment` | `assets.assign` | `{ "userId": 3 }` o `{ "userId": null }` | `200 Asset` |

`AssetInput`:
```json
{ "name": "Monitor LG 27", "type": "Notebook", "serial": "LG27-2026-009", "value": 189990, "location": "Bodega" }
```
Validaciones del servidor: `name` y `serial` obligatorios; `serial` único (sin distinguir mayúsculas) → `422`
con `errors.serial`; `type` y `location` dentro de los catálogos; `value` ≥ 0 o `null`.
Al asignar: el usuario debe existir y estar activo → si no, `422` con `errors.userId`.
Al eliminar un activo o cambiar su asignación, actualizar `assetCount` de los usuarios.

> Filtro, búsqueda y orden se hacen hoy en el navegador. Si el inventario crece (miles de filas), se
> recomienda aceptar `?q=&status=&sort=&order=&limit=&offset=` y mover esa lógica a `Assets.load()`.

### Usuarios

| Método y ruta | Permiso | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /users` | `users.view` (o `assets.assign`, para elegir responsable) | — | `200 { items: User[], total }` |
| `POST /users` | `users.write` | `UserInput` | `201 User` |
| `PUT /users/:id` | `users.write` | `UserInput` | `200 User` |
| `DELETE /users/:id` | `users.write` | — | `204` |
| `PATCH /users/:id/status` | `users.write` | `{ "status": "active" \| "disabled" }` | `200 User` |
| `GET /users/:id/backups` | `users.view` | — | `200 Backups` |

`UserInput`:
```json
{ "name": "Ana Pérez", "rut": "16.234.567-2", "email": "ana.perez@empresa.cl", "role": "Usuario", "area": "RRHH" }
```
Reglas del servidor:
- RUT válido (módulo 11) y único; email válido y único → `422` con `errors.rut` / `errors.email`.
- **No** eliminar, deshabilitar ni quitar el rol al **último administrador activo** → `409` (`LAST_ADMIN`).
- Un usuario no puede eliminarse ni deshabilitarse a sí mismo → `409`.
- Al eliminar un usuario, sus activos pasan a `Disponible` (`assignedTo: null`).
- Al renombrar, actualizar `assignedTo.name` en sus activos.

`Backups`:
```json
{
  "active": true,
  "intervalMin": 30,
  "lastRun": "2026-09-27T06:00:00.000Z",
  "nextRun": "2026-09-27T06:30:00.000Z",
  "folders": [{ "name": "Documentos", "files": 42, "size": "1.8 GB" }],
  "files": [{ "name": "Informe_Mensual_Sept.docx", "folder": "Documentos/Informes", "size": "2.1 MB", "modifiedAt": "2026-09-27T12:45:00.000Z", "url": "https://.../descarga-firmada" }]
}
```
`url` debe ser `https://` (o relativa). Si viene `null`, el botón muestra una descarga simulada.
Debe registrar en auditoría "Consultó respaldos de …".

### Auditoría

#### `GET /audit?type=&limit=50&offset=0` (permiso `audit.view`)
```json
{ "items": [ /* AuditEvent[], del más reciente al más antiguo */ ], "total": 128 }
```
- `type` opcional (`success`, `info`, `danger`, `warn`). `total` = cantidad que cumple el filtro.
- El frontend pide páginas de `CONFIG.features.auditPageSize` con el botón **Cargar más registros**.

#### `POST /audit/events` → `201 AuditEvent`
Eventos que solo conoce el navegador:
```json
{ "message": "Descargó instalador GestioApp-Setup.exe", "type": "info" }
```
Hoy se envían: "Accedió al Dashboard" (desactivable con `CONFIG.features.logDashboardVisits`),
"Exportó listado de activos (CSV)" y "Descargó instalador …". El servidor completa `actor` y `timestamp`.

---

## 4. Checklist para conectar

1. Implementar los endpoints de la sección 3 (o ajustar las rutas en `CONFIG.api.endpoints`).
2. En `index.html`, activar `window.GESTIO_CONFIG = { api: { mode: 'http', baseUrl: '...' } }`.
3. Configurar CORS si el dominio es distinto.
4. Crear en la base de datos los mismos valores de catálogos (`roles`, `areas`, `locations`, `assetTypes`) o
   ajustar `CONFIG.catalogs` a los del backend.
5. Replicar `CONFIG.permissions` en el servidor (el frontend solo oculta botones; **no es una barrera de seguridad**).
6. Probar: login correcto e incorrecto, token vencido (401 → vuelve al login), validaciones 422 junto a los campos.
