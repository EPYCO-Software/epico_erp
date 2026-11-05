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
- Pruebas: Vitest (`ng test`). Las que crean algo que use AuthService (como HistorialService) proveen
  `AUTH_STORAGE_KEY` en TestBed.

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
        core/              interceptors, modulos.ts (catálogo de módulos = la navegación; búsqueda sin acentos
                           (`normalizar`), favoritos, `menu` del encabezado de cada módulo (menús desplegables con enlaces y secciones con título, como Odoo; `enlacesDelMenu`), `activo` (por ahora solo CRM, Ventas y pedidos), `filtros`
                           de la pantalla de inicio (se suman: activados por defecto + favoritos; "todos" va solo) y moduloActivoGuard: canActivateChild del shell, cada ruta indica `data.modulo`), plantas.ts
                           (razones sociales con sus plantas y la selección: una principal + otras opcionales, nunca
                           vacía), mensajeria.ts (notificaciones, chats, canales y ventanas de chat abiertas; demo en
                           memoria), empresas.ts (concreteras del login) e historial.ts (HistorialService: el historial
                           de cada registro, como el chatter de Odoo sin mensajes: lo que hacen las pantallas con sus
                           campos antes → después, notas internas y actividades programadas; clave "tipo:id";
                           `ultimaEdicion`: lo último que no sea nota ni actividad)
        layout/            shell.ts (encabezado + contenido centrado hasta 1446 px). En escritorio nunca hay scroll de
                           página: el shell ocupa la ventana, el encabezado queda fijo y se desplaza el <main> (páginas
                           normales) o, en las páginas con barra en el encabezado, cada columna por su lado: la página
                           es la única celda de una rejilla `minmax(0,1fr)` (llena el alto y nunca es más ancha que la
                           pantalla) y sus cajas van en columnas de ese alto (COLUMNA, panel-lateral.ts) que se
                           desplazan con todo y caja, como en las apps de celular: sin barra, al bajar se van las
                           esquinas de arriba de la caja y al final aparecen las de abajo; donde queda cortada se
                           desvanece en la página (columna-caja). En celular, el scroll normal de la página. Toda pantalla nueva de lista con vista
                           previa usa CAJAS_LISTA (panel-lateral.ts) y toda vista completa CAJAS_VISTA
                           (vista-completa.ts): así todas las secciones se ven y se desplazan igual.
                           encabezado.ts: barra invisible de lado a lado (sin fondo, borde ni sombra; solo
                           desenfoca lo que pasa debajo): logo a la izquierda (vuelve a /inicio), buscador de módulos al
                           centro (⌘K / Ctrl+K) y, pegados a la derecha, globo de mensajes, plantas y avatar (sin
                           flechas). No hay menú lateral: se navega desde la pantalla de módulos.
                           Dentro de un módulo (data.modulo de la ruta; las secciones la heredan de una ruta padre sin
                           componente) el encabezado cambia como Odoo: botón para volver a los módulos, icono y nombre
                           del módulo y sus menús desplegables (CDK Menu como menubar: con uno abierto, al pasar el mouse por otro se abre ese; se
                           subraya el que contiene la página abierta); en celular van en una segunda fila con scroll de lado. Ahí
                           Ctrl+K vuelve a /inicio y enfoca el buscador.
                           - barra-encabezado.ts: la página declara `<ng-template appEnEncabezado>` con su barra (el
                             panel de control de Odoo: "Nuevo", título, buscador) y el encabezado la pinta debajo del
                             menú, fija arriba (la plantilla sigue evaluándose en la página). Mientras haya barra, el
                             <main> del shell va de lado a lado (sin el tope de 1446 px) y pegado a ella.
                           - panel-lateral.ts: lo que comparten las listas con vista previa (cotizaciones, órdenes,
                             clientes): `aside[appPanelLateral]` (columna con su caja; Esc lo cierra; con `liquido`,
                             Liquid Glass), FILA_LISTA (la
                             abierta con tinte y barra roja), seleccionMultiple() (las casillas: una, varias o todas; se
                             desmarcan cuando cambian las filas que se ven) y vistaPrevia() (foco al título del panel al abrir y a la
                             fila al cerrar). En esas listas la tabla también va en su columna: se desplaza de lado
                             dentro de su caja y, hacia abajo, con todo y caja (títulos y total se van con ella).
                           - vista-completa.ts: piezas de las vistas completas, como el formulario de Odoo: ruta de dos
                             renglones (la lista a la que se regresa, chica, y el registro en negritas), barra de estados
                             con flechas (en celular solo el actual) y botón a un registro relacionado ("Compra 2").
                           - historial.ts: `<aside appHistorial [registro]="'tipo:id'">` a la derecha de cada vista
                             completa (debajo en celular), una columna con su caja, como la hoja de al lado. Botones
                             "Registrar una nota" y "Actividad" (no hay "Enviar mensaje"), actividades planificadas
                             con su vencimiento y los movimientos por día. programar-actividad.ts: el diálogo de Odoo
                             (tipo, resumen, fecha límite, asignada a, nota; Guardar / Marcar como hecho / Descartar).
                             Toda vista completa nueva lo lleva, y sus acciones registran en él.
                           - menu-mensajeria.ts: globo como el de Odoo, un solo icono (no hay campana) con pestañas
                             Notificaciones (todo junto) / Chats / Canales y "Mensaje nuevo" (buscar una persona).
                           - chats.ts + ventana-chat.ts: chats abiertos abajo a la derecha; caben 3 a la vista y con
                             más la zona se desplaza de lado (row-reverse: el más reciente a la derecha). Minimizar =
                             burbuja redonda con el nombre al pasar el mouse (Esc lo oculta); Esc en una ventana la
                             minimiza. avatar-chat.ts: inicial o "#" sobre colores de la paleta oscurecidos (AA).
                           - selector-plantas.ts: como el de empresas de Odoo, plantas agrupadas por razón social; clic
                             en el nombre = solo esa, casillas = combinar.
                           - Los dos paneles son `popover` nativo (Esc, clic fuera y foco de vuelta los da el
                             navegador), colocados con `colocarBajo` (popover.ts) para no salirse de la ventana.
                           - ayuda.ts y preferencias.ts: diálogos del menú del avatar. Preferencias como Odoo
                             (Preferencias / Calendario / Seguridad), anclado arriba para que cambiar de pestaña no lo
                             mueva; edita una copia y solo "Actualizar preferencias" la guarda. Se abren por signal
                             para que, al cerrar, el foco vuelva al avatar. pestanas.ts: teclado de pestañas ARIA.
        features/inicio/   pantalla de módulos (destino tras el login), estilo app launcher: cuadrícula compacta y
                           centrada (cuadros de 76 px, 6 columnas de 150 px; con scroll si no cabe). Por defecto solo
                           los activados; el botón de filtros al final del buscador (filtro-modulos.ts: `popover` nativo
                           con casillas y conteos, como el selector de plantas; también en el buscador de celular) suma
                           filtros: Activados y Favoritos se combinan; Todos (favoritos arriba y luego los 17) quita los
                           demás. La búsqueda busca dentro de los filtros; si no encuentra, ofrece "Buscar en todos los
                           módulos".
                           acceso-modulo: enlace si el módulo está activo; si no, botón que abre un <dialog> de aviso.
                           icono-modulo: 17 iconos SVG propios, planos, en la paleta EPICO: rojo #C8151B, carbón
                           #2A2A2A, gris cálido #D0CAC3, gris medio #919191, arena #C59661 y terracota #AE5442
        features/modulos/  proximamente.ts (/modulos/:id): aviso de módulo no activado (también al escribir la
                           dirección de su página) o "en construcción" si está activo y aún no tiene página; con
                           `data.seccion`, una sección de un módulo aún sin página (`enConstruccion()` en app.routes.ts; las opciones del menú sin
                           página salen solas del `menu` con `menuEnConstruccion()`)
        features/ventas/   módulo Ventas (/ventas → /ventas/cotizaciones; el de clientes es CRM). cotizaciones.ts: vista de
                           lista como Odoo. En la barra del encabezado: "Nuevo", título y buscador con los filtros
                           aplicados como etiquetas (por defecto "Mis cotizaciones"; filtros-cotizaciones.ts: popover
                           con casillas, los estados se suman). Tabla de lado a lado con casillas para marcar varias o
                           todas (se desmarcan al cambiar búsqueda, filtros o plantas) y el total sin canceladas.
                           Solo las de las plantas elegidas en el encabezado. datos.ts: 12 cotizaciones demo (shortcut) y filtrarCotizaciones (con pruebas).
                           Clic o Enter en una fila: vista previa a la derecha (debajo en celular); × o Esc la cierran y
                           el foco vuelve a la fila. Mientras está abierta se ocultan las columnas Vendedor y Planta.
                           Doble clic o el ícono de vista completa del panel: cotizacion.ts
                           (/ventas/cotizaciones/:id), como el formulario de Odoo (ruta Cotizaciones / folio en la barra,
                           estados Borrador › Enviada › Pedido).
                           detalle-cotizacion.ts: lo mismo en el panel y en la vista completa, con el formato del portal
                           (ui-resumen-cotizacion). En borrador o enviada: Enviar (enviar-cotizacion.ts: si el cliente
                           está conectado al portal va a esa cuenta; si no, por correo, editable), Confirmar pedido
                           (como "Confirmar" en Odoo: se resalta cuando ya se envió) y Editar
                           (editor-cotizacion.ts: precio especial del concreto por producto, servicios, agregar o quitar
                           productos y descuento %, con totales en vivo). Editar una ya enviada la vuelve la revisión
                           R1, R2… en borrador (como en el portal). Con cambios sin guardar, la lista pregunta antes de
                           cambiar de fila o cerrar.
                           De cotización a pedido: confirmar genera un pedido por partida (cada entrega es una orden de
                           venta; `pedidoDePartida`, la misma regla del portal) y la cotización pasa a "Pedido"; desde
                           ella, "Pedido PED-… · estado" lleva a su orden.
                           Órdenes de venta (ordenes.ts, /ventas/ordenes): la misma lista que Cotizaciones (plantas del
                           encabezado, buscador, clic = vista previa, doble clic = vista completa). detalle-pedido.ts en
                           los dos lugares: estados de entrega y cobro (ui-estado-pedido, ui-estado-cobro), botón a la
                           cotización de la que salió (trazabilidad) y su partida con el mismo formato; su importe es el
                           neto de esa partida. pedido.ts (/ventas/ordenes/:folio): la ruta regresa a Órdenes de venta y
                           el botón "Cotización" va en la barra, como el de Odoo.
                           Clientes (clientes.ts, /ventas/clientes; detalle-cliente.ts y cliente.ts para /:id): lo mismo
                           que el cliente captura en el portal (contacto y empresa de Mi perfil, receptores de
                           Facturación y sus obras) y, por separado, sus cotizaciones y sus pedidos con enlace, del
                           editado más recientemente al más antiguo (la fecha de edición sale del historial). Lista con
                           casillas, vista previa y vista completa; Editar (editor-cliente.ts) con las reglas del portal
                           (RFC con `rfcValido` de ui, código postal, correos) y obligatorio solo lo que el ERP necesita;
                           guardar limpia los datos, cambia su nombre en sus cotizaciones y pedidos y queda en su
                           historial. Con cambios sin guardar, la lista pregunta antes de cambiar de fila o cerrar. El
                           cliente de cotizaciones y órdenes enlaza a su ficha.
                           datos.ts: CLIENTES (el modelo Cliente de ui; Constructora Delta, la del login de prueba del
                           portal, con sus mismos datos fiscales y sus obras Torre Norte y Bodega Escárcega), obras demo,
                           partidas como las del portal (total con `totalesCotizacion`), búsquedas sin acentos
                           (`coincide`, filtrar*) y VentasService (en memoria: cotizaciones y pedidos; guardar, enviar y
                           confirmar; clientes editables con guardarCliente, limpiarCliente y cambiosCliente; con
                           pruebas). Las demo que ya son pedido traen los suyos (PED-26-0151…).
                           Historial: cotizaciones, órdenes y clientes llevan el suyo en la vista completa (claves en
                           `registro`). Guardar cambios registra precio del concreto, descuento y total antes → después y
                           los productos y servicios agregados o quitados (`cambiosEntre`); enviar y confirmar registran
                           el estado y a dónde o qué pedidos; cada pedido nuevo, de qué cotización salió. Los registros
                           de ejemplo traen el suyo (historialDemo).
                           Menús iguales a Ventas de Odoo: Órdenes, Por facturar, Productos, Reportes y Configuración (con
                           secciones), salvo Equipos de ventas, desactivado hasta que tenga su lógica. Fuera de Cotizaciones, Órdenes y Clientes, sus opciones aún
                           en construcción.
                           nueva-cotizacion.ts (/ventas/cotizaciones/nueva, "Nuevo"): el cotizador del portal en una
                           sola hoja, para quien cotiza a diario: cliente y planta; por producto solución (aplica la
                           especificación y los servicios sugeridos del portal), obra, entrega, volumen,
                           especificación, aditivos, servicios y precio especial (vacío = tarifa); las recomendaciones
                           técnicas del portal se aplican con un clic y no bloquean; entrega de 18:00 a 06:59 = colado
                           nocturno. A la derecha, como en el portal, el resumen (productos, descuento, totales) con un
                           botón dividido: Guardar por omisión y, en su flecha (CDK Menu), Guardar y descargar o Solo
                           descargar (PDF con el folio que tendría, "Borrador sin guardar"); elegir cambia el botón, no
                           lo ejecuta. Guardar la crea en borrador con VentasService.crear (siguiente
                           folio de su planta, fecha en la hora de la planta) y abre su vista completa; con cambios
                           sin guardar, salir pregunta (canDeactivate). Si el cliente no está: "Cliente nuevo" (alta
                           rápida: nombre, contacto y teléfono; los datos fiscales se completan en su ficha) o "Sin
                           cliente" (PUBLICO_GENERAL, el cliente de mostrador). Sin cliente o sin obras se pide el lugar
                           de entrega (dirección, municipio, quién recibe y su teléfono): se guarda como obra
                           (VentasService.crearObra) y su municipio elige la planta (plantaDeMunicipio). "Elegir en el
                           mapa" (elegir-ubicacion.ts) guarda el punto GPS: ui-mapa-selector (Leaflet + OpenStreetMap,
                           libre y sin API key; Google Maps interactivo es de paga) con búsqueda y dirección del punto
                           por Nominatim (libre; llena dirección y municipio vacíos) y enlace "Ver en Google Maps".
                           Traslado: en el resumen, km incluidos (20) y $ por km adicional por m³; cada producto lleva
                           su distancia desde la planta: por carretera (OSRM libre, distancia.ts; sin servicio, la
                           recta × 1.3 marcada "aproximada") si planta y obra tienen punto en el mapa, o escrita por
                           quien cotiza (se respeta; borrarla la vuelve a calcular). Se guarda en la partida
                           (`traslado`) y lineasPartida (ui) agrega "Traslado adicional": totales, PDF y pedidos.
                           Órdenes → Nuevo (/ventas/ordenes/nueva, data.modo 'orden'): la misma hoja para crear la
                           orden de venta directo; el botón ofrece "Crear orden" (por omisión: una orden por producto,
                           sin cotización; cada una guarda su `partida` y `descuento` para sus líneas y su PDF) o
                           "Crear orden y cotización" (la cotización queda de respaldo, confirmada).
                           VentasService.crearOrdenes.
                           Prueba solo en Cotizaciones: la vista previa en Liquid Glass (`liquido`). Si gusta, pasa a
                           todas.
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
                           cotizador.state.ts (estado de la página, provisto en el componente), paso-solucion /
                           paso-especificaciones / paso-servicios / resumen. Las soluciones, las reglas técnicas, la
                           fecha de entrega, la planta por municipio, el tarifario y el PDF están en ui/cotizacion
                           (los usa también "Nueva cotización" del ERP)
                           y resumen-cotizacion (precios + "Descargar y guardar" por defecto / "Solo guardar" /
                           "Solo descargar"; folio provisional EPI-WEB-{planta}-{AA}{nnn})
        features/cotizaciones/ Mis cotizaciones: una tarjeta por serie (versión vigente + anteriores anidadas);
                           cotizacion-fila: resumen desplegable en la página (sin modal; es ui-resumen-cotizacion,
                           el mismo de la vista previa del ERP), Ver PDF (pestaña nueva),
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
                           ui-page-header, ui-resumen-cotizacion, ui-estado-pedido y ui-estado-cobro (estado de entrega y
                           de cobro de un pedido: tinte + icono + texto, iguales en portal y ERP)
      cotizacion/          formato.ts: el formato de una cotización, uno solo para portal y ERP: tarifario
                           (shortcut) y sus `RESISTENCIAS`, líneas (con el precio especial `precioM3` si lo hay),
                           totales con descuento e IVA (`totalesCotizacion`), `pesos`, etiquetas de la especificación,
                           servicios y maquinaria, agrupación por obra y fechaHoraCorta. ui-resumen-cotizacion lo pinta
                           (partidas por obra, líneas y totales). Cambiar el formato aquí lo cambia en las dos apps
                           (también el PDF y los pedidos del portal). `pedidoDePartida`: lo que lleva el pedido de cada
                           partida al aceptar (portal) o confirmar (ERP) una cotización.
                           plantas.ts: `plantaPara` (planta por municipio de la obra, con su contacto) y `fechaLarga`.
                           catalogo.ts (soluciones con su especificación y servicios sugeridos, OPCIONES de
                           resistencia, edad, revenimiento, TMA y cemento), reglas.ts (recomendaciones técnicas y
                           bombeo ↔ servicios) y entrega.ts (fecha de entrega: mín. 24 h y máx. 6 meses en el portal;
                           18:00–07:00 es nocturna). Los mismos en el cotizador del portal y en "Nueva cotización" del
                           ERP; con pruebas.
                           pdf.ts: `descargarCotizacionPdf` / `abrirCotizacionPdf`, el formato de la cotización impresa
                           EPI-PRES-…, sin logos (jsPDF + jspdf-autotable, MIT, cargados con import() al generar). El
                           mismo para el cliente en el portal y en el ERP (cotizaciones y órdenes de venta: botón PDF):
                           `tipo: 'orden'` titula "ORDEN DE VENTA" (una partida, entrega programada) y `emitida` (ERP)
                           quita la nota de "precios de referencia generados en el portal".
      time/                pipe fechaZona + token DEFAULT_TIMEZONE
      models/              Cliente (el del ERP y lo que el cliente captura en el portal: PerfilUsuario,
                           DatosEmpresaRepresentada, DatosFacturacion y sus documentos), Planta, Obra, Pedido (con
                           `cotizacionId` y `partidaId`; ESTADO_PEDIDO y ESTADO_COBRO
                           con los nombres en español), Remision, MuestraLaboratorio, cotización
                           (EspecificacionConcreto, ConfiguracionConcreto, PartidaCotizacion, DisenoGuardado; Cotizacion
                           del ERP = CotizacionGuardada del portal + cliente, planta, vendedor, EstadoCotizacion y
                           `envio`; el descuento y el `precioM3` de cada partida los pone el ERP y el portal los muestra)
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
  (solo rutas internas). Destino por defecto: `/inicio` (ERP, pantalla de módulos) y `/obras` (portal).
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
  `app.routes.ts` y el enlace en la navegación (en el ERP, la `ruta` del módulo en `core/modulos.ts`; `NAV` en el
  shell del portal).

## Estilos compartidos

- `projects/ui/styles/base.css`: tokens de color, `color-scheme: light`, fondo de concreto con halos rojos y barra de
  scroll con pulgar gris y riel transparente (`scrollbar-color`).
  Si una app necesita otro fondo (p. ej. la marca de una concretera), no lo importa y define el suyo.
- `projects/ui/styles/glass.css`: `glass`, `glass-strong` y utilidades de contenedores con scroll:
  - `sin-barra`: oculta la barra de scroll (sigue funcionando rueda, touch y teclado).
  - `scroll-caja`: caja con su propio scroll (menús, diálogos, chats): barra fina tipo píldora, 6 px visibles, sin riel
    y separada de las esquinas redondeadas; se oscurece al pasar el mouse. El scroll no pasa a la página al llegar al
    final. En el ERP, todo lo que se desplaza la usa, salvo las columnas de las páginas con barra (`columna-caja`).
  - `columna-caja`: columna de escritorio que se desplaza con todo y caja (en el ERP, COLUMNA): sin barra; donde la caja
    queda cortada, arriba o abajo, la desvanece una niebla con el mismo fondo fijo del body (no una máscara: le quitaría
    al vidrio el backdrop-filter), que aparece con el scroll (animación ligada al scroll; sin soporte, sin niebla). Sin
    relleno arriba ni abajo, porque sticky lo respeta: el aire lo pone la caja, su único hijo.
  - `vidrio-liquido` (+ `-borde`, `-cuerpo`, `-brillo`): Liquid Glass, en prueba. No es `glass`: el filo es vidrio claro
    que dobla lo de atrás como una lente (filtro SVG #vidrio-liquido; solo Chrome y Edge, los demás se quedan con el
    desenfoque), con brillos en la orilla y una luz que sigue al puntero; el centro es esmerilado y opaco para que el
    texto pase AA aunque atrás esté el halo rojo (medido: 4.74:1 en el peor caso). Las capas son hermanas dentro de un
    contenedor sin backdrop-filter. Se vuelve sólido con "reducir transparencia" o "más contraste" del sistema.
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
- `ui-user-menu`: menú del avatar con Angular CDK Menu (flechas, Esc, roles ARIA). Se abre con clic, teclado o al pasar
  el mouse (abierto así se cierra al salir o con Esc; un clic lo deja fijo; en touch solo el toque). `opciones` +
  `(elegir)` agregan opciones de la app antes de "Cerrar sesión"; en el ERP: `[letras]="2" claro` con Ayuda y Mis
  preferencias. Los popups del CDK se pintan al final de `<body>`: envolver el contenido en una región con nombre para
  que axe no marque "region".
- `ui-icon`: importar cada icono por nombre desde `lucide` y exponerlo en el componente
  (`protected readonly iconos = { correo: Mail }`). Siempre decorativo (`aria-hidden`).

### Utilidades glass

- `glass`: tarjetas y contenedores normales: bg-white/60 + brillo diagonal (background-image), backdrop blur-xl y
  saturate-150 (los halos del fondo se cuelan con color), filo de luz arriba (inset-shadow) y sombra amplia y suave.
  Para otro tono basta `bg-white/NN`; el brillo y el filo se mantienen.
- `glass-strong`: capas encima de otras (drawer, diálogos, menús): bg-white/78, blur-2xl y sombra más marcada.
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
