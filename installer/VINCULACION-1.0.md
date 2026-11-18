# GestioApp Agent: instalador con código — versión candidata 1.0

Cambios sobre commit 33ece1c del agente. Este ZIP es un paquete de archivos modificados/nuevos;
extraer sobre una copia del repositorio respetando las rutas. No es un instalador EXE ni un proyecto completo.
Requiere el backend/frontend de vinculación entregado junto con este paquete y su migración PostgreSQL.

## Configurar y compilar en Windows

1. Instalar SDK .NET 10 e Inno Setup 6 en el PC de desarrollo.
2. Revisar `installer/enrollment.default.json`. El valor incluido es `https://systelnet.net:3000`.
   Debe coincidir con ENROLLMENT_PUBLIC_URL del servidor, sin rutas adicionales. No contiene secretos.
3. Desde la raíz del proyecto, publicar:

```powershell
dotnet publish .\GestioApp.Agent\GestioApp.Agent.csproj -c Release -r win-x64 --self-contained true -o .\publish\agent
dotnet publish .\GestioApp.Tray\GestioApp.Tray.csproj -c Release -r win-x64 --self-contained true -o .\publish\tray
```

4. Abrir `installer/GestioApp.iss` en Inno Setup y Compilar (o ejecutar ISCC.exe con esa ruta).
5. El resultado será `publish\installer\GestioApp-Setup.exe`. Compartir solamente ese EXE con el usuario final.

El instalador incluye .NET mediante la publicación self-contained. No incluye el certificado privado de la beta:
HTTPS debe ser confiable en Equipo local antes del canje. No se desactiva TLS y no se sigue una redirección
al enviar el código. No empaquetar privkey.pem ni tokens definitivos compartidos.

## Primera instalación

En la web actualizada: Activos -> Añadir equipo -> nombre -> copiar código. Ejecutar el instalador como
administrador, pegar el código (se aceptan guiones y espacios) y continuar. Necesita conexión al servidor.

Se preparan las carpetas con las ACL existentes, se genera/preserva device-id.txt, se canjea el código y se
escriben automáticamente Config/agent.json y Config/api-token.txt. Solo entonces se inicia el servicio.
La función de envío de actividad mantiene su configuración previa (desactivada en instalaciones nuevas).

El token no se pasa por línea de comandos ni se imprime. Config es accesible por administradores/SYSTEM
para escritura y LocalService para lectura. El archivo api-token.txt sigue siendo texto protegido por ACL;
este cambio no incorpora DPAPI. El UUID no es secreto y no autentica por sí solo.

## Reintentos y actualizaciones

Si falla la red, se muestra un error y se puede volver a ejecutar el mismo instalador con el mismo código.
Config/enrollment-pending.json contiene el secreto de recuperación, requestId, UUID y hash del código;
no borrarlo ni compartirlo. Permite recuperar la credencial durante 24 horas desde el canje exitoso en servidor.
Se elimina al completar la escritura local. El código de entrada temporal se elimina incluso ante un error.

Si el servicio falla después del canje, la configuración se conserva: volver a ejecutar el instalador
reintenta el registro/arranque del servicio sin consumir un código nuevo. Un equipo ya configurado con token
no vacío y apiEnabled true omite la pantalla y conserva su configuración; esto NO verifica que su token siga vigente.
Para reinstalación limpia o cambio de servidor se requiere un procedimiento administrativo, no reutilizar código usado.
La primera vinculación silenciosa no está soportada; se bloquea para no instalar simulando un registro exitoso.

Para cambiar el intervalo posteriormente, editar ProgramData/GestioApp/Config/agent.json y reiniciar el servicio.
No modificar Program Files/GestioApp/Setup/agent.default.json pensando que cambia la configuración activa.

## Piloto obligatorio antes de distribuir

- VM Windows limpia con TLS confiable: instalar, canjear y comprobar inventario/heartbeat en backend.
- Código incorrecto/vencido/usado: mostrar error, sin activar la API con credenciales incorrectas.
- Cortar red antes del canje y reintentar. Simular respuesta perdida y comprobar recuperación sin duplicados.
- Actualizar equipo existente: conservar device-id.txt, token y configuración.
- Comprobar ACL con cuenta no administradora: no debe leer Config ni el secreto temporal.
- Revocar desde web: nuevas peticiones del token deben devolver 401.

El backend pasó 48 pruebas Node/PGlite. Este entorno no tiene Windows, PowerShell de Windows ni Inno Setup;
NO se ha compilado ni ejecutado este instalador. Su código se entrega para compilar y probar en ese piloto.
No se implementan unión al dominio, VPN ni instaladores personalizados en esta versión.
