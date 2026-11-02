# EPICO

Workspace Angular 22 multi-app para concreteras. Diseño glassmorphism en tema oscuro.

| Proyecto | Tipo | Usuarios | Puerto dev |
|---|---|---|---|
| `erp` | app | Concreteras (mis clientes): operación, flota, laboratorio, facturación… | 4200 |
| `portal` | app | Clientes de las concreteras (constructoras): sus obras, pedidos, remisiones, facturas y laboratorio | 4201 |
| `ui` | librería | Código compartido entre ambas apps | — |

## Stack

- Angular 22 (standalone, signals, zoneless y OnPush por defecto), TypeScript 6 estricto
- Tailwind CSS v4 vía PostCSS (`.postcssrc.json` en la raíz, aplica a todo el workspace)
- PrimeNG 22 + `@primeuix/themes` (Aura extendido) + `tailwindcss-primeui` + PrimeIcons + `@angular/cdk`
  - No usar `@primeng/themes` (obsoleto) ni `provideAnimations*` (PrimeNG 22 no lo requiere).
  - Sin clave en `providePrimeNG({ license })`, PrimeNG muestra un aviso de licencia.
- Pruebas: Vitest (`ng test`)

## Estructura

```
.postcssrc.json            Tailwind para todo el workspace
tsconfig.json              paths: "ui" → ./projects/ui/src/public-api.ts (sin compilar la lib en dev)
projects/
  erp/
    public/  src/
      styles.css           importa tailwind, primeui, primeicons, ../../ui/styles/base.css y glass.css
      app/
        core/              guards, interceptors, servicios globales (placeholders)
        layout/            shell, sidebar colapsable + drawer móvil, topbar, nav-items.ts
        features/          una carpeta por módulo, cada página es ruta lazy (export default)
  portal/
    public/  src/
      styles.css           mismo esquema que el ERP
      app/
        layout/shell.ts    topbar con logo, menú (drawer en móvil) y avatar
        features/          obras, pedidos, remisiones, facturas, laboratorio (lazy)
  ui/
    styles/base.css        tema oscuro (color-scheme) y fondo con gradientes
    styles/glass.css       @utility glass / glass-strong
    src/public-api.ts      todo lo exportado
    src/lib/
      theme/               GlassPreset (PrimeNG)
      components/          ui-glass-card, ui-kpi-card, ui-page-header
      time/                pipe fechaZona + token DEFAULT_TIMEZONE
      models/              Cliente, Planta, Obra, Pedido, Remision, MuestraLaboratorio (+ tipos *Vista)
```

## Qué va en `ui` y qué en cada app

- **`ui`**: lo que ambas apps usan igual. Tema, utilidades CSS, componentes de presentación sin lógica de
  negocio ni servicios, y modelos de dominio. Selector con prefijo `ui-`. No puede importar nada de `erp` ni
  de `portal`. Si agregas una dependencia nueva, decláralo en `projects/ui/package.json` (`peerDependencies`).
- **Cada app**: layout, navegación, rutas, guards, interceptors, servicios con estado, páginas y datos mock.
  Si algo de una app empieza a repetirse en la otra, se mueve a `ui`.
- Importar siempre `from 'ui'`, nunca con rutas relativas hacia `projects/ui`. La excepción es el CSS
  (`@import '../../ui/styles/base.css'`, `glass.css` y `@source '../../ui/src'`).

## Modelos

- Modelo de dominio: solo ids para las relaciones (`clienteId`, `obraId`, `pedidoId`, `remisionId`).
- Tipo de vista (`PedidoVista`, `ObraVista`, `RemisionVista`, `MuestraLaboratorioVista`): extiende el
  modelo y agrega los nombres a mostrar (`clienteNombre`, `obraNombre`…). Las tablas usan el tipo de vista.
- Estados como union type en snake_case (`EstadoPedido`); las etiquetas en español se resuelven en la vista.

## Fechas y zonas horarias

Las plantas están en zonas distintas (Quintana Roo UTC−5 `America/Cancun`; Yucatán y Campeche UTC−6
`America/Merida`). La hora que se muestra es la de la planta, nunca la del navegador.

- Fechas siempre como string ISO 8601 **con offset** (`2026-11-02T07:30:00-05:00`).
- Cada `Planta` tiene `zonaHoraria` (IANA). Los modelos llevan `plantaId` y los tipos de vista traen
  `zonaHoraria` (y `plantaNombre`) ya resueltos.
- Mostrar fechas con el pipe `fechaZona` de `ui`, nunca con `DatePipe` (no acepta zonas IANA):
  `{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria : 'HH:mm' }}`. Tokens: `yyyy`, `MM`, `dd`, `HH`, `mm`;
  formato por defecto `dd/MM/yyyy HH:mm`.
- Si no viene zona se usa `DEFAULT_TIMEZONE` (`America/Merida`). Una app puede cambiarlo con
  `{ provide: DEFAULT_TIMEZONE, useValue: 'America/Cancun' }`. Una zona inválida cae al default con
  `console.warn`.

## Convenciones

- Textos de UI en español; nombres de dominio en español.
- Componentes standalone con `input()`/`output()`, signals, `inject()`, `@if`/`@for`.
- Estilos con utilidades Tailwind en el template; CSS de componente solo si no hay utilidad.
- Accesibilidad: botones de solo icono con `aria-label`, iconos decorativos con `aria-hidden="true"`,
  `ariaCurrentWhenActive="page"` en los enlaces de navegación.
- Para agregar una página: `features/<nombre>/<nombre>.ts` con `export default class`, la ruta hija en
  `app.routes.ts` y el enlace en la navegación (`layout/nav-items.ts` en el ERP, `NAV` en el shell del portal).

## Estilos compartidos

- `projects/ui/styles/base.css`: `color-scheme: dark` y fondo con gradientes (el blur necesita algo detrás).
  Si una app necesita otro fondo (p. ej. la marca de una concretera), no lo importa y define el suyo.
- `projects/ui/styles/glass.css`: solo las utilidades `glass` y `glass-strong`.
- Ambas apps importan los dos después de `tailwindcss`.

### Utilidades glass

- `glass`: tarjetas y contenedores normales (bg-white/10, blur-xl, borde white/15, rounded-2xl, sombra).
- `glass-strong`: capas encima de otras (drawer, diálogos, popovers propios).
- Usar `backdrop-filter` (glass) solo en contenedores: sidebar, topbar, cards, diálogos. Nunca en filas de
  tabla ni en elementos repetidos. Las tablas van dentro de una `ui-glass-card` y el preset deja sus filas
  transparentes.
- Sobre componentes PrimeNG usa `styleClass="glass-strong!"` (el `!` gana a la capa `primeng`).
- Orden de capas: `@layer theme, base, primeng, utilities;` (utilidades Tailwind > PrimeNG).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:erp` (o `npm start`) | `ng serve erp` en http://localhost:4200 |
| `npm run start:portal` | `ng serve portal` en http://localhost:4201 |
| `npm run build:erp` / `build:portal` / `build:ui` | Build de producción en `dist/<proyecto>` |
| `npm run build:all` | ui → erp → portal |
| `ng test` / `ng test erp` | Pruebas de todo el workspace o de un proyecto |

No existe `defaultProject`: indica siempre el proyecto en `ng serve`/`ng build`/`ng generate`
(`ng g c foo --project portal`).

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
