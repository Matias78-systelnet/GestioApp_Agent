# Validación de GestioApp 0.3

- Compilación de Contracts, Agent y Tray para net10.0/net10.0-windows con SDK .NET 10.0.401 en Linux y EnableWindowsTargeting=true.
- 14 comprobaciones automáticas aprobadas: clasificación de estados, huecos y transiciones; contrato de duraciones; round-trip del protocolo; límite de mensaje y persistencia sin sobrescritura.
- Configuración JSON y proyectos XML revisados; ícono y ruta de instalación conservados.
- No ejecutado en Windows: WinForms, WTS, inactividad real, named pipe con LocalService/usuario estándar, suspensión, RDP ni asistente Inno Setup.
- No integrado todavía con el backend real. La API de actividad permanece desactivada por defecto. Ver ACTIVIDAD.md para contrato y pruebas de aceptación.

Esta es una entrega piloto de código fuente compilable, no una certificación de funcionamiento en producción ni un instalador ya probado.
