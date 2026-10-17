# Novedad 0.3: actividad de sesión

Ver **ACTIVIDAD.md** para pruebas, instalación y contrato del nuevo endpoint. Medición visible con inicio/pausa; envío de actividad desactivado por defecto. Ranking de aplicaciones pendiente.

# GestioApp Agent 0.2 — guía de desarrollo

## Qué contiene esta entrega
Servicio Windows real, inventario WMI, interfaz de bandeja, publicación autocontenida y asistente Inno Setup. El ZIP original tenía la carpeta GestioApp.Agent vacía: se añadió el proyecto.
Se conservaron agent.cs (prueba independiente), Program.cs y formularios de plantilla de Tray.

No se incluye un instalador compilado nuevo. Este entorno no tiene Windows, SDK .NET ni Inno Setup; no fue posible compilar o ejecutar WMI/servicios. Los ejecutables antiguos se excluyeron para no confundirlos con esta versión.

## 1. Compilar en tu Windows
Requisitos DEL DESARROLLADOR: SDK .NET 10, Windows x64 e Inno Setup 6 actualizado.
Desde la carpeta que contiene build.ps1:

```powershell
.\build.ps1
```
Si la política local permite scripts firmados únicamente, respeta la política de tu organización y firma el script; no cambies políticas corporativas.
Abre installer/GestioApp.iss y pulsa Compile. Resultado: publish/installer/GestioApp-Setup.exe.
El destinatario solo ejecuta ese instalador como administrador: se incluyen runtimes .NET, DLL de System.Management y dependencias. No necesita SDK ni Visual Studio. Windows debe ser compatible con .NET 10 y contar con WMI y Windows PowerShell 5.1 operativos. No se compila Native AOT.

## 2. Prueba primero en una VM
1. Instala sin configurar API. El servicio GestioAppAgent usa LocalService y arranque automático.
2. Doble clic al icono: CPU, RAM, serie, usuario de consola y volúmenes aparecen después de la primera lectura. Puede tardar si WMI no responde.
3. La pestaña JSON muestra el mismo objeto que enviará el servicio. API debe indicar desactivada, no enviado.
4. Cierra el icono: Get-Service GestioAppAgent debe seguir Running.
5. Reinicia Windows. El servicio inicia sin sesión; el icono aparece al iniciar sesión.
6. Detén el servicio: en unos 3 minutos la ventana debe marcar los datos como anteriores. Reanúdalo.
7. Instala nuevamente para probar actualización. Comprueba que device-id.txt y configuración se conservan.
8. Desinstala: desaparecen servicio y registro de inicio. ProgramData se conserva para no perder identidad ni configuración al reinstalar; un administrador debe eliminar esa carpeta si retira definitivamente el dispositivo, y revocar su token en el servidor.

## 3. Dónde editar
- GestioApp.Contracts/Inventory.cs: campos/contrato; cambialos coordinadamente con la API.
- GestioApp.Agent/InventoryService.cs: consultas de hardware.
- GestioApp.Agent/Workers.cs: ciclos de inventario y heartbeat independientes.
- GestioApp.Agent/ApiClient.cs: HTTP POST con Bearer y timeout.
- GestioApp.Tray/TrayApplicationContext.cs: ventana y formato visual.
- installer/agent.default.json: valores por defecto de NUEVAS instalaciones.
- C:\ProgramData\GestioApp\Config\agent.json: configuración activa. Editar como administrador y reiniciar el servicio.
- installer/GestioApp.iss y ServiceSetup.ps1: instalación del servicio y permisos.

La comunicación local usa un archivo JSON reemplazado atómicamente, en lugar de una named pipe: suficiente para estado de solo lectura. State permite lectura a usuarios locales; solo LocalService, administradores y SYSTEM escriben. Config permite lectura al servicio y modificación a administradores/SYSTEM. No hay API local de comandos privilegiados.

## 4. Significado exacto de los datos
CPU = modelos, no porcentaje de utilización. RAM = suma de capacidad de módulos en bytes.
Almacenamiento = volúmenes fijos listos, con TotalFreeSpace; no inventario físico ni USB clasificados como removibles. Una letra por partición; no sumar como si fueran discos físicos.
Serie = valor BIOS del fabricante: puede ser genérico o ausente, no identifica de forma segura. DeviceId persistente es independiente; no clones una imagen con este ID/token ya generado.
ConsoleUser = Win32_ComputerSystem.UserName: usuario de consola, NO sesiones RDP ni usuario asignado en la plataforma. Null puede indicar sin sesión o lectura no disponible: revisar errors. Sesiones bloqueadas pueden conservar usuario. La enumeración de sesiones RDP queda para una próxima versión.
Errors informa lecturas parciales; no se inventan valores. Las llamadas WMI tienen timeout solicitado, pero un proveedor bloqueado puede no respetarlo; para endurecimiento adicional conviene aislar el recolector en otro proceso. El heartbeat no espera al recolector.

## 5. Configurar API (contrato propuesto, todavía no conectado a tu backend)
El servidor debe implementar POST de inventario y POST de heartbeat, aceptar JSON camelCase y validar un token individual asociado al deviceId. Una respuesta 2xx significa aceptación HTTP, no prueba de guardado en base de datos. La UI dice expresamente HTTP 2xx.
Usar inventoryId como clave de idempotencia: el servicio reintenta cada 30 s; puede repetir una captura tras un timeout. Una nueva captura cada 300 s sustituye a la anterior pendiente. Se conserva el último estado, NO una cola histórica duradera: al reiniciar se obtiene una captura nueva.
Nunca aceptar el deviceId como autenticación. El registro automático de equipos y emisión/revocación de tokens debe hacerse en el backend antes del despliegue masivo.

Después de registrar el deviceId y generar su token, en PowerShell elevado:

```powershell
.\scripts\Configure-Api.ps1 -InventoryEndpoint 'https://TU-SERVIDOR/api/agents/inventory' -HeartbeatEndpoint 'https://TU-SERVIDOR/api/agents/heartbeat'
```
Reemplaza ambas URL por las reales. El script pide el token sin mostrarlo y lo guarda en un archivo protegido por ACL; no está cifrado en disco, no debe incluirse en ZIP ni Git. Se requiere HTTPS válido: no se omite validación TLS ni se siguen redirecciones con credenciales.
Config se lee al iniciar; reinicia el servicio después de cambiarla. Ante 401, corrige el token; ante 404 revisa la ruta.

JSON heartbeat: {"schemaVersion":1,"deviceId":"uuid","sentAtUtc":"fecha UTC"}.
Online lo calcula Node.js con hora de RECEPCIÓN del servidor, por ejemplo lastSeenAt < 180 s para heartbeat de 60 s. La actividad local que muestra Tray no equivale a online en el servidor.

## 6. Validación de API
Con un receptor HTTPS de pruebas, comprobar igualdad del inventoryId y los campos entre la pestaña JSON y el body recibido. No editar System RAM/serie en la UI.
- API 2xx: mostrar captura aceptada y su fecha.
- Token inválido: mostrar HTTP 401/403, sin marcar éxito.
- Servidor sin conexión: mantener inventario visible y error de envío, sin cerrar el agente.
- Restaurar conexión: siguiente reintento envía automáticamente.
- Serial ausente/WMI con error: otras lecturas continúan.

## 7. Instalación y actualizaciones
El asistente detiene el servicio antes de copiar, configura ACL, registra LocalService, recuperación automática y comprueba señal reciente. Conserva AppId del instalador anterior para actualizar en el mismo producto. Cierra el icono antes de actualizar; Inno también intenta cerrar archivos en uso.
El instalador no implementa rollback transaccional completo: si falla el paso de servicio, informa el error; usa el script instalado con -Action Install como administrador tras corregirlo o desinstala. Prueba primero en VM.
Los runtimes incluidos deben actualizarse republicando periódicamente; no se actualizan con el runtime compartido del sistema. Los binarios/instalador no están firmados en esta entrega; firma de código y canal de actualización verificado son pendientes para distribución empresarial.

## 8. Fuera del alcance de esta entrega
No instala/configura WireGuard, no une a Samba AD, no modifica rutas/DNS, no añade control remoto. Esas funciones necesitan endpoint, configuración VPN y flujo de credenciales confirmado. No hay interfaz para guardar contraseñas del dominio.
El icono personalizado está en GestioApp.Tray/Assets/gestioapp.ico. Se utiliza en los ejecutables, la ventana de inventario, la bandeja junto al reloj y el instalador. El punto verde es parte fija del diseño; no representa el estado de conexión. Ver ICONO.md para recompilar y comprobar el cambio.

## 9. Ejecución en desarrollo
Tras una instalación de prueba que cree carpetas/ACL, detén el servicio y ejecuta dotnet run --project GestioApp.Agent como administrador para depurarlo. No ejecutes dos instancias del agente contra el mismo State. Ejecuta Tray con dotnet run --project GestioApp.Tray.
