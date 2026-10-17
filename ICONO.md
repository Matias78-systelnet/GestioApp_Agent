# Ícono personalizado de GestioApp

Se incorporó el archivo ICO proporcionado, sin modificar su diseño.

## Archivos actualizados
- `GestioApp.Tray/Assets/gestioapp.ico`: recurso compartido del ícono.
- `GestioApp.Tray/GestioApp.Tray.csproj`: ícono del ejecutable; copia el ICO a la salida y publicación.
- `GestioApp.Agent/GestioApp.Agent.csproj`: ícono del ejecutable del servicio.
- `installer/GestioApp.iss`: ícono de Setup y desinstalador.
- `README.md`: referencia al nuevo ícono.

TrayApplicationContext.cs ya utiliza este ICO en la ventana y en NotifyIcon. No requiere cambios. El punto verde permanece fijo y no indica conectividad con la API.

## Probar sin instalar
1. Extraer el proyecto en una carpeta nueva. Si tu proyecto local tiene cambios posteriores, incorpora únicamente los cambios indicados arriba; conserva tu código y configuración.
2. En el menú junto al reloj, cerrar la instancia anterior mediante «Salir del icono (el agente continúa)».
3. Abrir PowerShell en la carpeta que contiene build.ps1 y ejecutar:

```powershell
dotnet run --project .\GestioApp.Tray\GestioApp.Tray.csproj
```

Comprobar el ícono junto al reloj (puede estar dentro de la flecha de íconos ocultos), hacer doble clic y comprobar el de la ventana. Sin servicio o datos locales disponibles puede aparecer «servicio sin datos»; eso no impide comprobar el ícono. No ejecutar el servicio solo para esta comprobación visual.

## Publicar y generar el instalador
Se requiere el SDK .NET 10 y, para el instalador, Inno Setup 6 en Windows.

```powershell
dotnet publish .\GestioApp.Agent\GestioApp.Agent.csproj -c Release -r win-x64 --self-contained true -o .\publish\agent
dotnet publish .\GestioApp.Tray\GestioApp.Tray.csproj -c Release -r win-x64 --self-contained true -o .\publish\tray
```

Verificar que ambos comandos finalicen correctamente. Comprobar que exista `publish\tray\Assets\gestioapp.ico`.

Abrir `installer\GestioApp.iss` en Inno Setup y pulsar Compile. El resultado será `publish\installer\GestioApp-Setup.exe`. Cerrar el ícono anterior antes de ejecutar el instalador de actualización. Conservar el AppId existente.

Los comandos directos de publicación evitan tener que cambiar la política de ejecución de PowerShell para ejecutar build.ps1.

## Comprobaciones finales
- Ejecutables Agent y Tray: nuevo ícono en el Explorador.
- Bandeja, ventana y acceso directo: nuevo ícono al ejecutar la nueva versión.
- Setup y entrada de desinstalación: nuevo ícono tras compilar e instalar.
- Inventario/API: mismo funcionamiento previo.

Si el Explorador conserva una imagen antigua, comprobar primero que se está abriendo el ejecutable recién publicado. Cerrar la aplicación y volver a abrirla; si persiste, cerrar sesión y entrar nuevamente para refrescar la vista de Windows.

## Validación de esta entrega
Se revisaron las referencias del proyecto, las rutas del instalador, el contenido del ICO y su inclusión en el ZIP. No se compiló ni ejecutó en Windows en este entorno; las comprobaciones anteriores deben realizarse en tu equipo. El paquete contiene código fuente, no ejecutables compilados.
