# EPICO ERP

ERP para una concretera. Angular 22 standalone + TypeScript estricto, diseño glassmorphism en tema oscuro.

## Stack

- Angular 22 (standalone, signals, zoneless por defecto, OnPush por defecto)
- Tailwind CSS v4 vía PostCSS (`.postcssrc.json` → `@tailwindcss/postcss`)
- PrimeNG 22 + `@primeuix/themes` (preset Aura extendido) + `tailwindcss-primeui` + PrimeIcons
  - No usar `@primeng/themes` (obsoleto) ni `provideAnimations*` (PrimeNG 22 ya no lo requiere).
  - Tema: `src/app/theme/glass-preset.ts`, registrado en `app.config.ts` con `darkModeSelector: '.app-dark'`
    y `cssLayer` `primeng`. La clase `app-dark` está fija en el `<html>` de `index.html`.
- Pruebas: Vitest (`ng test`)

## Estructura

```
src/app/
  core/      servicios globales, interceptors, guards (placeholders por ahora)
  shared/    componentes reutilizables: glass-card, page-header, kpi-card
  layout/    shell (sidebar + topbar), nav-items.ts define el menú
  features/  una carpeta por módulo; cada página es ruta lazy (loadComponent, export default)
  theme/     preset de PrimeNG
```

Para agregar un módulo: crea `features/<nombre>/<nombre>.ts` con `export default class`, agrega la ruta
hija en `app.routes.ts` y el ítem en `layout/nav-items.ts`.

## Convenciones

- Textos de UI en español; código (nombres de archivos/clases) puede ir en español según el dominio.
- Componentes standalone con `input()`/`output()`, signals, `inject()`, `@if`/`@for`.
- Estilos con utilidades Tailwind en el template; CSS de componente solo si no hay utilidad.
- Accesibilidad: botones de solo icono con `aria-label`, iconos decorativos con `aria-hidden="true"`.

## Utilidades glass (`src/styles.css`)

- `glass`: tarjetas y contenedores normales (bg-white/10, blur-xl, borde white/15, rounded-2xl, sombra).
- `glass-strong`: capas encima de otras (drawer, diálogos, popovers propios).
- Usar `backdrop-filter` (glass) solo en contenedores: sidebar, topbar, cards, diálogos. Nunca en filas
  de tabla ni elementos repetidos: cuesta mucho al renderizar. Las tablas van dentro de una `app-glass-card`
  y el preset deja sus filas transparentes.
- Sobre componentes PrimeNG usa `styleClass="glass-strong!"` (el `!` gana a la capa `primeng`).
- Orden de capas: `@layer theme, base, primeng, utilities;` (utilidades Tailwind > PrimeNG).

## Comandos

- `npm start` / `ng serve`: servidor de desarrollo en http://localhost:4200
- `ng build`: build de producción en `dist/epico-erp`
- `ng test`: pruebas unitarias

---

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
