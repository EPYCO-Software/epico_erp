# EPICO · Frontend

Vive en `Frontend/` del repo (junto a `Backend/`); todas las rutas y comandos de este archivo son relativos a `Frontend/`.

Workspace Angular 22 multi-app para concreteras. Identidad EPICO: tema claro de concreto, glass blanco discreto y rojo EPICO como acento.

| Proyecto | Tipo | Usuarios | Puerto dev |
|---|---|---|---|
| `erp` | app | Concreteras (mis clientes): operación, flota, laboratorio, facturación… | 4200 |
| `portal` | app | Clientes de las concreteras (constructoras): sus obras, pedidos, remisiones, facturas y laboratorio | 4201 |
| `ui` | librería | Código compartido entre ambas apps | — |

## Stack

- Angular 22 (standalone, signals, zoneless y OnPush por defecto), TypeScript 6 estricto
- Tailwind CSS v4 vía PostCSS (`.postcssrc.json` en `Frontend/`, aplica a todo el workspace)
- UI: HTML nativo + Tailwind + Angular CDK (MIT) para lo que necesita comportamiento accesible (menús).
- Iconos: Lucide (`lucide`, ISC) a través de `<ui-icon [icono]="Mail" />`.
- **Solo dependencias con licencia libre** (MIT, ISC, Apache, OFL…). Nada de pago ni que pida clave.
  PrimeNG/PrimeIcons/`@primeuix` se retiraron porque desde la v22 exigen licencia comercial (PrimeUI).
  Antes de instalar algo, revisar su campo `license`.
- Pruebas: Vitest (`ng test`)

## Estructura

```
.postcssrc.json            Tailwind para todo el workspace
tsconfig.json              paths: "ui" → ./projects/ui/src/public-api.ts (sin compilar la lib en dev)
projects/
  erp/
    public/  src/
      styles.css           importa tailwind, overlay del CDK, ../../ui/styles/{base,glass,forms}.css y entrada-login.css
      public/img/          planta-login.webp (sin uso desde el login nuevo)
      app/
        core/              interceptors, servicios globales (placeholders)
        layout/            shell, sidebar colapsable + drawer móvil, topbar, nav-items.ts
        features/auth/     login del ERP (/login) y capas-glass.ts: baraja de 3 cartas de vidrio (la principal con cara
                           oscura SVG y dos detrás, pegadas, que se reparten al entrar; los vidrios son HTML con
                           backdrop-filter recortado con clipPath objectBoundingBox), tarjetas de módulos inclinadas y
                           red de conexiones. Todo dentro del lienzo escalado; la parte izquierda va 45 px a la izquierda
                           y el formulario 40 px a la derecha del mockup, para dar aire entre ambos
        features/          una carpeta por módulo, cada página es ruta lazy (export default)
  portal/
    public/  src/
      styles.css           mismo esquema que el ERP
      app/
        layout/shell.ts    topbar con logo, menú (drawer en móvil) y menú de usuario
        features/auth/     login del portal (/login)
        core/services/     CotizacionService (diseños guardados y partidas), ObrasService (obras del cliente con
                           dirección y GPS) y ChatService (atención al cliente):
                           hoy en memoria; reemplazar por HTTP/canal real sin tocar la UI
        layout/chat-flotante.ts  burbuja de atención al cliente: fija abajo a la derecha, z-70, en todas las páginas
        features/catalogo/ cotizador "Configuremos tu pedido" (destino tras el login):
                           datos.ts (soluciones, opciones, servicios), reglas.ts (etiquetas, recomendaciones técnicas,
                           bombeo ↔ servicios; con pruebas), cotizador.state.ts (estado de la página, provisto en el
                           componente), paso-solucion / paso-especificaciones / paso-servicios / resumen,
                           entrega.ts (fecha estimada: mín. 24 h, máx. 6 meses; 18:00–07:00 agrega y bloquea
                           "colado-nocturno"), presupuesto.ts (shortcut: tarifario de referencia, líneas, IVA 16 %,
                           planta por municipio), pdf-cotizacion.ts (formato de la cotización impresa
                           EPI-PRES-…, sin logos; jsPDF + jspdf-autotable, MIT, cargados con import() al descargar)
                           y resumen-cotizacion (precios + "Descargar y guardar" por defecto / "Solo guardar" /
                           "Solo descargar"; folio provisional EPI-WEB-{planta}-{AA}{nnn})
        features/cotizaciones/ Mis cotizaciones: una tarjeta por serie (versión vigente + anteriores anidadas);
                           cotizacion-fila: resumen desplegable en la página (sin modal), Ver PDF (pestaña nueva),
                           Descargar, Modificar (CotizacionService.editar 'revision' → folio …-R1, -R2; la original
                           no cambia) y Usar como base ('base' → serie nueva con baseId). Hay dos cotizaciones demo.
                           cotizacion.ts (/cotizaciones/:folio): detalle con flujo y "Aceptar y generar pedido".
        features/obras/    Mis obras y obra.ts (/obras/:id). obra-form: alta y edición (lo usa también el cotizador) con
                           responsable (nombre + foto opcional) y contactos (lada +52 por defecto, extranjeros 6–14
                           dígitos; telefono.ts con pruebas). Una obra con pedido en curso no se edita
                           (PedidosService.obraConPedidoEnCurso).
        features/pedidos/  Mis pedidos: totales (total, pagado, pendiente), tabla con hover; clic = vista previa a la
                           derecha (pedido-previa), doble clic o el folio = abre el pedido, la obra enlaza a /obras/:id.
                           Pedido.cobro: por_facturar | en_facturacion | facturado | pagado (+ importe y facturaFolio).
                           Seguimiento de camiones (seguimiento.ts con pruebas, seguimiento-entrega,
                           SeguimientoService): un pedido en planta/en ruta/en obra muestra sus camiones (ViajeCamion,
                           uno o varios) en `ui-mapa-seguimiento` (Leaflet + OpenStreetMap, sin API key; CSS
                           importado en styles.css) y en texto. Señal: en vivo (<2 min), perdida (última posición) o
                           sin GPS (solo horarios). shortcut: viajes simulados (demo PED-26-0140, 3 camiones).
                           pedido.ts (/pedidos/:folio) y flujo.ts: etapas Cotización → Pedido →
                           En entrega → Entregado para `ui-pipeline` (barra tipo Odoo en el encabezado; cada etapa
                           enlaza a su documento para ir y volver). Pedido.cotizacionId liga el pedido con su
                           cotización; PedidosService (demo PED-26-0141 ← EPI-WEB-CZM-26002) genera uno por partida.
                           Rutas con :folio usan withComponentInputBinding (input `folio`).
        features/          obras, remisiones, facturas, laboratorio (lazy)
  ui/
    assets/                marca/ (logo, isotipo, favicons) y fondos/; se sirven en /ui/… en ambas apps
    styles/base.css        tokens de color (@theme), color-scheme claro y fondo de concreto
    styles/glass.css       @utility glass / glass-strong
    styles/forms.css       @utility campo / casilla / boton-primario (controles nativos)
    src/public-api.ts      todo lo exportado
    src/lib/
      auth/                AuthService, authGuard, guestGuard, destinoSeguro, AUTH_STORAGE_KEY
      components/          ui-icon, ui-drawer, ui-user-menu, ui-field-error, ui-mapa, ui-glass-card, ui-kpi-card, ui-pipeline,
                           ui-page-header
      time/                pipe fechaZona + token DEFAULT_TIMEZONE
      models/              Cliente, Planta, Obra, Pedido, Remision, MuestraLaboratorio, cotización
                           (EspecificacionConcreto, ConfiguracionConcreto, PartidaCotizacion, DisenoGuardado)
                           (+ tipos *Vista)
```

## Qué va en `ui` y qué en cada app

- **`ui`**: lo que ambas apps usan igual. Tema, utilidades CSS, componentes de presentación sin lógica de
  negocio ni servicios, y modelos de dominio. Selector con prefijo `ui-`. No puede importar nada de `erp` ni
  de `portal`. Si agregas una dependencia nueva, decláralo en `projects/ui/package.json` (`peerDependencies`).
- **Cada app**: layout, navegación, rutas, guards, interceptors, servicios con estado, páginas y datos mock.
  Si algo de una app empieza a repetirse en la otra, se mueve a `ui`.
- Importar siempre `from 'ui'`, nunca con rutas relativas hacia `projects/ui`. La excepción es el CSS
  (`@import '../../ui/styles/base.css'`, `glass.css`, `forms.css` y `@source '../../ui/src'`).

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

## Identidad visual

Tokens en `projects/ui/styles/base.css` (`@theme`): generan utilidades como `bg-epico`, `text-texto-suave`.

| Token Tailwind | Valor | Uso |
|---|---|---|
| `epico` | #D3181E | Botón primario, selección activa, enlaces, detalles importantes. Con moderación |
| `epico-oscuro` | #A31217 | Hover y texto rojo sobre tintes claros (contraste AA) |
| `carbon` | #1A1A1C | Texto principal y superficies oscuras |
| `concreto` | #F3F3F1 | Fondo principal |
| `acero` | #AEB4B8 | Bordes decorativos (tarjetas, separadores) |
| `acero-oscuro` | #8A9196 | Borde de campos de formulario (3:1, WCAG 1.4.11) |
| `texto-suave` | #696D71 | Texto secundario (4.7:1 sobre concreto) |
| `info` / `atencion` / `correcto` / `critico` | #3B82A0 / #D99A2B / #3F8065 / #B9473E | Estados. En texto pequeño usar tinte de fondo + texto oscurecido (ver etiquetas de estado del dashboard) |

- Marca de la app (en `projects/ui/assets/marca/`, servida en `/ui/marca/…`). No redibujar ni alterar:
  - `logo-epico-erp-horizontal.webp` (1200×383): wordmark "ΞPICO® ERP", logo principal sobre fondos claros
    (login del portal).
  - `logo-epico-erp.webp` (800×662): logo con planta y revolvedora. Su texto es oscuro: sobre fondos oscuros va
    en una placa clara.
  - `logo-epico-erp-blanco.webp` (1200×184): wordmark "ΞPICO® | ERP" en blanco, fondo transparente, para fondos
    oscuros (login del ERP).
  - `isotipo-epico-erp.webp` (400×307): topbars y espacios pequeños, junto al nombre de la app en texto.
  - `iconos/`: favicons (32, 192) y `apple-touch-icon` (180, fondo blanco) a partir del isotipo.
  - Siempre con `<img ngSrc … width height>` (tamaño intrínseco) y el alto por clase (`h-9`, `h-24`).
- Tipografía: **Figtree** (Google Fonts, cargada en el `index.html` de cada app; `--font-sans` en base.css).
  Títulos en bold con `tracking-[-0.02em]`; etiquetas tipo eyebrow en mayúsculas con tracking amplio.
- Fondos (`/ui/fondos/`, WebP sin pérdida: no recomprimir, los degradados se arruinan): `fondo-concreto.webp`
  (app) y `fondo-login.webp` (con losas de concreto, login).
- Logins sin scroll y con las proporciones del mockup:
  - Escritorio (lg): el mockup es un lienzo de 1586×992 que se escala completo. `--u = min(100vw/1586, 100dvh/992)`
    y `--spacing = 4u`, así que las clases de Tailwind se escriben con las medidas del mockup ÷ 4 (`h-15` = 60 px
    del mockup). Textos con mínimo legible: `text-[max(14px,calc(var(--u)*17))]`. Mínimos en px, no en spacing.
  - Celular: diseño apilado con medidas `clamp(…, Ndvh, …)` (`--campo`, `--boton`, `--hueco`).
  - Probar en 1920×945, 1536×730, 1366×657, 1280×610, 390×750 y 360×640.
- Referencia de proporciones: login del portal (`projects/portal/src/app/features/auth/login.html`): campos
  `h-15` con texto de 17px e iconos de 22px, botón primario `h-15.5`, tarjeta `rounded-[2.25rem]` con `p-14`.
- Nunca comunicar un estado solo con color: acompañar con texto, icono, peso o `aria-*`.
- Animaciones: solo transiciones breves de color/opacidad. Excepción: la entrada del login del ERP
  (`projects/erp/src/entrada-login.css`, utilidades `entrada-*`): coreografía de menos de 5 s, sin bucles, apagada con
  `prefers-reduced-motion`. Nunca animar opacity/filter en un contenedor de un elemento con backdrop-filter (se vuelve
  backdrop root y el vidrio deja de ver el fondo): se anima cada elemento.

## Autenticación

- Todas las rutas de cada app viven bajo un shell con `canActivate: [authGuard]`; `/login` usa `guestGuard`.
  Sin sesión, una ruta privada manda a `/login?returnUrl=…`; al entrar se vuelve ahí con `destinoSeguro()`
  (solo rutas internas). Destino por defecto: `/dashboard` (ERP) y `/obras` (portal).
- `AuthService` (en `ui`) guarda la sesión en localStorage si el usuario marca "Mantener sesión/Recordarme",
  si no en sessionStorage. Cada app provee su `AUTH_STORAGE_KEY` (`epico.erp.sesion`, `epico.portal.sesion`)
  para que ERP y portal nunca compartan sesión.
- **Hoy el login es estático** (`shortcut:` en `AuthService.login` y en el `DEMO` de cada login): acepta
  cualquier credencial y el formulario viene lleno para entrar con un clic. Para conectar el backend: reemplazar
  el cuerpo de `login()` por la llamada HTTP (que lance error si falla), vaciar `DEMO` y, si aplica, agregar el
  token en `core/interceptors/api.interceptor.ts` del ERP. Las pantallas no cambian.
- Errores de login: mensaje genérico, sin revelar qué dato falló.
- Formularios nuevos con Signal Forms (`form`, `[formField]`, `submit`) y `ui-field-error` enlazado con
  `aria-describedby`; al enviar inválido, mover el foco al primer campo con error.

## Convenciones

- Textos de UI en español; nombres de dominio en español.
- Componentes standalone con `input()`/`output()`, signals, `inject()`, `@if`/`@for`.
- Estilos con utilidades Tailwind en el template; CSS de componente solo si no hay utilidad.
- Accesibilidad: botones de solo icono con `aria-label`, iconos decorativos con `aria-hidden="true"`,
  `ariaCurrentWhenActive="page"` en los enlaces de navegación.
- Para agregar una página: `features/<nombre>/<nombre>.ts` con `export default class`, la ruta hija en
  `app.routes.ts` y el enlace en la navegación (`layout/nav-items.ts` en el ERP, `NAV` en el shell del portal).

## Estilos compartidos

- `projects/ui/styles/base.css`: tokens de color, `color-scheme: light` y fondo de concreto con halos rojos.
  Si una app necesita otro fondo (p. ej. la marca de una concretera), no lo importa y define el suyo.
- `projects/ui/styles/glass.css`: `glass`, `glass-strong` y utilidades de contenedores con scroll:
  - `sin-barra`: oculta la barra de scroll (sigue funcionando rueda, touch y teclado).
  - `desvanecer-abajo`: degradado inferior; no se usa a mano, lo pone la directiva `uiDesvanecer` (en `ui`)
    mientras quede contenido abajo y lo quita al llegar al final. Uso: `<div uiDesvanecer class="sin-barra overflow-y-auto">`.
- Páginas con columnas de scroll independiente (catálogo del portal): alto `h-(--alto-contenido)`, definido en el
  shell del portal; solo en escritorio, en celular scroll normal de página.
- `projects/ui/styles/forms.css`: controles nativos con la identidad EPICO. El alto, padding y tamaño de texto van
  en cada uso:
  - `campo`: `<input>`, `<select>` (con `appearance-none` + `ui-icon` ChevronDown) y `<textarea>`. Foco rojo
    visible y borde `critico` con `aria-invalid="true"`.
  - `casilla`: checkbox nativo (`accent-color` rojo).
  - `interruptor`: switch sobre checkbox nativo (usar con `role="switch"`).
  - `segmento`: opción de un control segmentado (radio `sr-only` dentro de `<label class="segmento">`).
  - `boton-primario`: botón principal rojo; en carga, `[disabled]` + `aria-busy` + icono LoaderCircle con `animate-spin`.
- Ambas apps importan los tres después de `tailwindcss`.

### Piezas interactivas de `ui`

- `ui-mapa`: Google Maps embebido en modo libre (sin API key ni costo). Con GPS muestra el punto exacto; si no,
  busca la dirección. Uso: `<ui-mapa class="h-60" [ubicacion]="obra.ubicacion" [direccion]="…" titulo="Mapa de …" />`.

- `ui-drawer`: panel lateral sobre `<dialog>` nativo (`showModal`): trampa de foco, Esc, fondo inerte y
  devolución del foco los da el navegador. Uso: `<ui-drawer [(abierto)]="x" titulo="Menú">…</ui-drawer>`.
- `ui-user-menu`: menú del avatar con Angular CDK Menu (flechas, Esc, roles ARIA). Los popups del CDK se pintan
  al final de `<body>`: envolver el contenido en una región con nombre para que axe no marque "region".
- `ui-icon`: importar cada icono por nombre desde `lucide` y exponerlo en el componente
  (`protected readonly iconos = { correo: Mail }`). Siempre decorativo (`aria-hidden`).

### Utilidades glass

- `glass`: tarjetas y contenedores normales (bg-white/65, blur-md, borde white/80, rounded-2xl, sombra ligera).
- `glass-strong`: capas encima de otras (drawer, diálogos, popovers propios).
- Usar `backdrop-filter` (glass) solo en contenedores: sidebar, topbar, cards, diálogos. Nunca en filas de
  tabla ni en elementos repetidos. Las tablas son `<table>` nativas dentro de una `ui-glass-card`, con filas
  transparentes.
- No poner CSS de componente (`styles:`) que compita con utilidades: queda fuera de las capas y le gana a
  Tailwind (p. ej. rompe `lg:hidden`). Preferir clases en el template.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:erp` (o `npm start`) | `ng serve erp` en http://localhost:4200 |
| `npm run start:portal` | `ng serve portal` en http://localhost:4201 |
| `npm run build:erp` / `build:portal` / `build:ui` | Build de producción en `dist/<proyecto>` |
| `npm run build:all` | ui → erp → portal |
| `ng test` / `ng test erp` | Pruebas de todo el workspace o de un proyecto |
| `docker compose up --build` (en la raíz del repo) | Ambas apps en contenedores como en producción: ERP en :8080, portal en :8081 |

## Docker y CI

- `docker-compose.yml` y `.github/` están en la raíz del repo; el contexto de build de las imágenes es `Frontend/`.
- `Dockerfile` único con `--build-arg APP=erp|portal`: compila con Node 24 y sirve `dist/<app>/browser` con
  nginx sin root en el puerto 8080 (`docker/nginx.conf`: fallback SPA a `index.html`, `index.html` sin caché y JS/CSS
  con hash cacheados un año).
- `.github/workflows/docker.yml`: en cada push a `main` (o a mano) construye las dos imágenes y las sube a GHCR
  (`ghcr.io/<usuario>/epico_erp-erp` y `-portal`, etiquetas `latest` y `sha-…`). El job `deploy` está vacío.
- Probar siempre lo que dependa de librerías CommonJS cargadas con `import()` (p. ej. Leaflet) en el build de
  producción: ahí el módulo puede llegar bajo `default`.

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
