# GestioApp 0.3 — Sesiones e inactividad (piloto)

Esta entrega agrega el recolector de sesiones a Tray, recepción local en el servicio y envío HTTPS con cola persistente. No agrega ranking de aplicaciones, capturas, registro de teclas, marcación formal de asistencia ni panel web. No modifica WireGuard ni Samba AD.

## Probar primero sin instalar

Extraer el proyecto en una carpeta nueva. Cerrar el Tray anterior desde su menú (no detener el servicio para esta prueba). Desde la carpeta que contiene build.ps1:

```powershell
dotnet run --project .\tests\ActivityChecks\ActivityChecks.csproj
dotnet run --project .\GestioApp.Tray\GestioApp.Tray.csproj
```

1. Abrir el menú del ícono: «Iniciar / pausar medición de sesión». Leer el aviso e iniciar.
2. Doble clic al ícono y abrir «Actividad de sesión».
3. Usar teclado/mouse: aumenta Activo.
4. Dejar el equipo desbloqueado sin entrada más de 5 minutos: aumenta Inactivo.
5. Bloquear con Win+L durante 30 segundos y desbloquear: aumenta Bloqueado. Las transiciones pueden clasificarse como Desconocido.
6. Suspender y reanudar: el hueco de muestreo aumenta Desconocido, no Activo.
7. Pausar: se detienen los contadores. Cerrar Tray detiene la medición.

No hace falta un servicio nuevo para ver los contadores. Si todavía está instalado el servicio 0.2, la entrega local quedará pendiente; los lotes se conservan bajo `%LOCALAPPDATA%\GestioApp\Activity\<SessionId>`. No es un fallo del inventario.

## Instalar el servicio actualizado

El SDK .NET 10 e Inno Setup 6 son necesarios en el equipo de desarrollo.

```powershell
dotnet publish .\GestioApp.Agent\GestioApp.Agent.csproj -c Release -r win-x64 --self-contained true -o .\publish\agent
dotnet publish .\GestioApp.Tray\GestioApp.Tray.csproj -c Release -r win-x64 --self-contained true -o .\publish\tray
```

Verificar éxito en ambos comandos. Compilar `installer\GestioApp.iss` en Inno Setup. Cerrar Tray y ejecutar `publish\installer\GestioApp-Setup.exe`. La actualización conserva la configuración y el token existentes.

El instalador crea `%PROGRAMDATA%\GestioApp\ActivityQueue`, privada para LocalService, SYSTEM y administradores. No crearla manualmente con permisos abiertos. La cola contiene usuario y mediciones; no debe quedar legible para todos los usuarios.

`activityEnabled` vale true por defecto: permite la recepción local. La medición en Tray comienza pausada hasta que el usuario la inicia; recuerda la elección para ese usuario/SessionId. La indicación ON/OFF está en el tooltip. Si se cierra Tray, no se miden intervalos nuevos; al abrirlo se reintentan lotes ya guardados del mismo perfil, incluso de otra sesión anterior.

## Semántica y límites

- Muestreo cada 5 segundos. Inactivo al superar 300 segundos sin entrada de teclado/mouse. No se captura el contenido de las entradas.
- Los 5 contadores son excluyentes: activo, inactivo, bloqueado, desconectado y desconocido.
- Cambios de estado entre muestras y huecos mayores de 15 segundos se clasifican como desconocidos. No se puede reconstruir el instante exacto de cambio.
- Bloqueo/desbloqueo: notificaciones WTS de la sesión. RDP desconectado: consulta de estado WTS. Escritorio seguro/UAC, estado inicial no comprobable o error nativo: desconocido.
- No se registran eventos exactos de inicio/cierre de sesión. Las fechas son inicio/fin del intervalo observado, no la hora contractual de entrada/salida.
- Un collectorId identifica cada ejecución de Tray. SessionId es un identificador temporal de Windows y se reutiliza; nunca usarlo como identidad permanente del empleado.
- Duraciones mediante reloj monotónico. Fechas UTC ancladas al comienzo del lote; un cambio manual del reloj puede requerir marcar el período como inconsistente en servidor.
- Los contadores de pantalla son de esta ejecución, no totales diarios persistidos. Los lotes sí sobreviven a reinicios.
- Cuando no hay recolector no hay lotes. La web debe mostrar ese hueco como «sin medición», sin transformarlo en tiempo inactivo. El heartbeat del equipo no acredita actividad del usuario.
- No sumes sesiones simultáneas de la misma persona sin resolver solapamientos. Para reportes, conservar detalle por equipo/collectorId/sesión y usar unión de intervalos cuando corresponda.
- El usuario puede pausar o cerrar el recolector y los datos del cliente se pueden manipular. Es telemetría orientativa, no una prueba de productividad ni control de asistencia inviolable.

## Persistencia y reintentos

Tray guarda un lote aproximadamente cada minuto; al pausar/cerrar intenta guardar el intervalo parcial. Escribe primero un temporal, fuerza escritura y renombra. Un cierre abrupto puede perder hasta aproximadamente el último minuto aún en memoria; no se rellena después como actividad.

Tray entrega lotes al servicio mediante un named pipe local, con mensajes de máximo 16 KiB y timeout. El servicio obtiene SID/nombre del token Windows del cliente, no de campos de identidad proporcionados en JSON. El pipe deniega identidades de red. Los SessionId históricos son datos del recolector, no una identidad autenticada.

El servicio acusa solo después de escribir en su cola; entonces Tray borra su copia. El token API nunca se entrega a Tray. Solo se elimina el lote del servicio tras HTTP 200 con el mismo batchId. Caídas entre guardado y acuse pueden producir reintentos: el backend debe deduplicarlos.

Capacidad: hasta 1440 lotes locales por carpeta de sesión y 20000 pendientes en el servicio. Al llenarse la cola local, la medición se pausa y debe reanudarse manualmente tras corregir la causa; no se sobrescriben lotes guardados. El intervalo que estaba en memoria al llenarse puede perderse si se cierra el proceso. Son límites de cantidad, no una política de retención temporal. Los archivos `.invalid` o `.rejected` requieren revisión y eliminación manual tras investigar; no se envían automáticamente.

El cliente local reintenta en cada ciclo (hasta 5 lotes); el servicio intenta hasta 100 lotes por ciclo y espera 30 segundos. Un error HTTP conserva el lote y detiene ese ciclo. No implementa backoff exponencial. Un 401, un 409 o un esquema rechazado requieren corrección administrativa para desbloquear el envío.

## Habilitar la nueva API

Primero implementar el endpoint en el backend. En PowerShell como administrador:

```powershell
notepad "$env:ProgramData\GestioApp\Config\agent.json"
```

Añadir estas propiedades al objeto JSON existente, respetando comas y conservando las de inventario/heartbeat:

```json
{
  "activityEnabled": true,
  "activityApiEnabled": true,
  "activityEndpoint": "https://TU-SERVIDOR/api/agents/activity"
}
```

Este fragmento no reemplaza el archivo completo. `activityApiEnabled` es independiente de `apiEnabled` y por defecto es false. Reutiliza `Config\api-token.txt`, token individual ya asociado al equipo. Reiniciar:

```powershell
Restart-Service GestioAppAgent
```

Para detener la recepción del servicio, poner `activityEnabled: false` y `activityApiEnabled: false`, y reiniciar. Para detener la recolección, pausar también en Tray; desactivar la API por sí solo deja los registros en cola.

## Contrato del backend

Ruta propuesta: `POST /api/agents/activity`. HTTPS, sin redirección. Headers: `Content-Type: application/json` y `Authorization: Bearer <token-del-equipo>`.

Ejemplo completo en `docs/activity-example.json`. Estructura:

| Campo | Significado |
|---|---|
| schemaVersion | Versión del sobre: 1 |
| deviceId | UUID, debe coincidir con el equipo autorizado por el token |
| userSid | SID Windows obtenido por el servicio local |
| userName | Nombre Windows obtenido por el servicio local; no es una credencial |
| receivedAtUtc | Recepción en servicio Windows; NO es hora del servidor Node.js |
| activity.schemaVersion | Versión del lote: 1 |
| activity.batchId | UUID único del lote; conservarlo durante todos los reintentos |
| activity.collectorId | UUID de esta ejecución de Tray |
| activity.sessionId | Entero no negativo, sesión Windows informada |
| activity.startedAtUtc / endedAtUtc | Fechas del intervalo en UTC |
| activity.activeSeconds / idleSeconds / lockedSeconds / disconnectedSeconds / unknownSeconds | Números finitos no negativos; admiten decimales |
| activity.idleThresholdSeconds | 300 en esta versión |

Validar tipos, UUID, fechas, límite de cuerpo (propuesta: 16 KiB), longitudes de textos (SID 184, nombre 256) y versión 1. La suma de las cinco duraciones debe coincidir con endedAtUtc - startedAtUtc con tolerancia menor de 1 segundo. El intervalo no puede ser negativo ni mayor de 7 días. Marcar/rechazar fechas futuras según política explícita; aceptar lotes antiguos reenviados tras desconexión. Guardar una fecha adicional de recepción usando el reloj del servidor.

Autenticar primero y obtener organización/deviceId del token. No confiar en una organización enviada por el cliente. SID identifica una cuenta Windows en ese contexto: su vínculo con la persona/empleado debe administrarse en la plataforma. Usuarios con cuentas distintas pueden representar la misma persona.

Persistencia dentro de transacción:
1. Clave única `(deviceId, activity.batchId)`.
2. Si no existe, guardar lote y usuario junto con hora del servidor.
3. Si existe, comparar userSid y contenido del objeto activity normalizado. Una retransmisión puede tener receivedAtUtc diferente en el servicio y el nombre de cuenta puede cambiar; esos metadatos no invalidan un lote idéntico.
4. Mismo ID con mediciones o SID distintos: 409 y registrar incidencia.
5. Confirmar la transacción antes de responder.

Éxito y duplicado idéntico:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{"batchId":"11111111-1111-4111-8111-111111111111"}
```

El batchId debe ser el recibido. 202, 204, HTML de login o un 200 sin ese batchId NO borran el lote. Respuesta máxima admitida: 4 KiB. Errores: 400/422 inválido, 401 token, 403 equipo ajeno, 409 conflicto, 413 tamaño, 415 tipo, 429 límite, 500/503 fallo de almacenamiento. No incluir secretos en errores ni registrar Authorization.

Esta entrega no modifica el backend Node.js ni crea tablas ni dashboard en el servidor. El documento define la integración necesaria para su desarrollador.

## Pruebas antes de desplegar

| Caso | Resultado esperado |
|---|---|
| Primera ejecución | Medición pausada, aviso antes de iniciar |
| Uso, inactividad >5 min, Win+L | Contadores correspondientes; transiciones desconocidas |
| Suspender/reanudar | No suma la suspensión como tiempo activo |
| Pausar/cerrar Tray | Deja de medir; guarda último intervalo cuando puede |
| Servicio detenido >2 min | Aparecen lotes locales; inventario conserva comportamiento previo |
| Servicio 0.3 iniciado | Acuse local, lote pasa a ActivityQueue |
| API deshabilitada/caída | Cola del servicio permanece; el registro no se elimina |
| API 200 sin batchId, 202 o 204 | Registro permanece en cola |
| API 200 con batchId correcto | Registro desaparece de cola tras persistencia remota |
| Repetir lote tras perder respuesta | Un solo registro en base de datos |
| Usuario estándar y RDP | Lectura y pipe funcionan sin elevar Tray; identidad correcta |
| Otro usuario | No puede leer ActivityQueue ni token API |
| Nuevas sesiones y reinicio | Nuevo collectorId; no se inventan intervalos anteriores |

Pruebas automáticas del contrato y clasificación:

```powershell
dotnet run --project .\tests\ActivityChecks\ActivityChecks.csproj
```

Las pruebas de escritorio, permisos efectivos, suspensión, RDP e instalación requieren Windows. Medición no validada todavía en un equipo Windows real.

## Archivos principales para aprender

- `SessionProbe.cs`: APIs de Windows y eventos de sesión.
- `ActivityCollector.cs`: contadores, pausa, cola del usuario y entrega al servicio.
- `GestioApp.Contracts/Activity.cs`: contrato, validación, framing del pipe y escritura durable.
- `ActivityWorker.cs`: identidad Windows, cola privada y envío del servicio.
- `ApiClient.cs`: confirmación explícita del batchId en HTTPS.
- `TrayApplicationContext.cs`: pestaña, menú y estado visible.

Referencia: https://learn.microsoft.com/windows/win32/termserv/wm-wtssession-change
Referencia: https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-getlastinputinfo
Referencia: https://learn.microsoft.com/dotnet/api/system.io.pipes.namedpipeserverstream.runasclient
