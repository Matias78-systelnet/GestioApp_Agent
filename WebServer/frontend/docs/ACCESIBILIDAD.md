# Accesibilidad — GestioApp

Objetivo: **WCAG 2.2 nivel AA**.

## Cómo se verificó (27-09-2026)

- **axe-core 4.10** (motor de Lighthouse) con reglas WCAG 2.0/2.1/2.2 A y AA en: Landing, Login, Dashboard
  (escritorio y móvil), Activos, Usuarios, Auditoría, Descargas, Configuración y modales con errores.
  Resultado: **0 infracciones**.
- Contraste medido por axe en ~350 elementos. Los que axe marca "para revisión manual" son textos sobre
  fotografía o degradado: el overlay oscuro (86–96 % de opacidad) con texto blanco o `#FF8A33` los deja por
  sobre 4.5:1. **Si se cambia una foto o el overlay, revisar a mano.**
- Pruebas de teclado: navegación con Tab, selección de filas con Espacio/flechas, modales con Escape,
  foco devuelto al botón que abrió el modal, enlace "Saltar al contenido".

## Qué está implementado (y dónde)

| Criterio WCAG | Implementación | Archivo |
|---|---|---|
| 1.1.1 Contenido no textual | Íconos decorativos con `aria-hidden`; botones solo-ícono con texto oculto | `components.js` → `icon()` |
| 1.3.1 Información y relaciones | Landmarks (`header`, `nav`, `main`, `footer`), títulos en orden, tablas con `caption`, `th scope`, listas reales | todas las plantillas |
| 1.4.3 Contraste | Tokens de color medidos (ver comentario en `css/styles.css`) | `styles.css :root` |
| 1.4.10 Reflow | Responsive hasta 320 px; tablas con desplazamiento horizontal propio | `styles.css` |
| 1.4.11 Contraste de componentes | Bordes de inputs y botones ≥ 3:1; radios y switches en `--brand-strong` | `styles.css` |
| 2.1.1 Teclado | Todo es `<button>`/`<a>`/`<input>` nativo; filas seleccionables con radio | `assets.js`, `users.js` |
| 2.1.2 Sin trampas | Modales atrapan el foco y se cierran con Escape; el foco vuelve al origen | `ui.js`, `a11y.js` |
| 2.2.1 Tiempo ajustable | Cierre por inactividad configurable (`auth.sessionTimeoutMin`), con aviso | `auth.js` |
| 2.3.3 / 2.2.2 Movimiento | Respeta `prefers-reduced-motion` + opción "Reducir animaciones" en Configuración | `a11y.js`, `settings.js` |
| 2.4.1 Saltar bloques | Enlace "Saltar al contenido principal" (primer Tab) | `index.html` |
| 2.4.2 Título de página | `document.title` = "Sección — GestioApp" en cada ruta | `router.js` |
| 2.4.3 Orden del foco | Tras navegar, el foco va al `<h1>` de la nueva página | `router.js` → `A11y.focusPage` |
| 2.4.7 Foco visible | Anillo de 3 px (`--focus`), blanco sobre fondos oscuros | `styles.css` |
| 2.5.8 Tamaño del objetivo | Controles ≥ 32 px (botones pequeños), ≥ 40–44 px el resto | `styles.css` |
| 3.3.1 / 3.3.3 Errores | Mensaje junto a cada campo (`aria-describedby`, `aria-invalid`), resumen y foco en el primer error; los errores del servidor (422) se muestran igual | `ui.js` → `Ui.form` |
| 3.3.2 Etiquetas | `<label for>` en todos los campos, obligatorios marcados y explicados | `components.js` → `field()` |
| 3.3.4 Prevención de errores | Confirmación antes de eliminar o deshabilitar (`alertdialog`) | `ui.js` → `Ui.confirm` |
| 4.1.2 Nombre, rol, valor | `aria-pressed` (filtros), `aria-sort` (orden), `aria-expanded` (menús), `aria-current` (navegación y pasos) | módulos |
| 4.1.3 Mensajes de estado | Regiones `aria-live` (polite/assertive) para avisos, resultados de búsqueda y cambios | `index.html`, `a11y.js` |

Extra: soporte del modo de alto contraste de Windows (`forced-colors`).

## Reglas para el equipo

1. **Nunca** `onclick=""` ni `<div>` clicables: usar `<button type="button" data-action="…">` o `<a href data-go="…">`.
2. Todo ícono decorativo: `Components.icon('bi-…')` (agrega `aria-hidden`). Si un botón solo tiene ícono,
   agregar `<span class="visually-hidden">Texto</span>`.
3. Todo campo con `Components.field()` / `Components.selectField()`; errores con `Ui.form.setErrors()`.
4. Todo modal con `Components.modal()` y abrirlo con `Ui.openModal()` (maneja foco, `inert` y Escape).
5. Confirmaciones destructivas con `await Ui.confirm({ danger: true, … })`, no `window.confirm`.
6. Avisos con `Ui.notify()` (anuncia a lectores de pantalla automáticamente).
7. Texto naranja sobre fondo claro: `var(--brand-strong)`. `--brand` (#FF6B00) solo es decorativo o para fondos oscuros.
8. Cada página nueva: un único `<h1 id="page-title">` (lo genera `Components.pageHero()`).

## Prueba manual rápida antes de publicar

- [ ] Recorrer la página solo con teclado (Tab / Shift+Tab / Enter / Espacio / Escape).
- [ ] Zoom del navegador al 200 %: nada se corta ni se superpone.
- [ ] Lector de pantalla (NVDA en Windows o VoiceOver en Mac): anuncia título de la página, errores y confirmaciones.
- [ ] Activar "Reducir animaciones" en Configuración: sin movimiento.
- [ ] Extensión **axe DevTools** o Lighthouse → Accesibilidad sin infracciones.
