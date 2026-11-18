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
        core/              interceptors (api.interceptor: token en /api; con 401, un refresh y reintento; si no,
                           al login), modulos.ts (catálogo de módulos = la navegación; búsqueda sin acentos
                           (`normalizar`), favoritos, `menu` del encabezado de cada módulo (menús desplegables con enlaces y secciones con título, como Odoo; `enlacesDelMenu`), `activo` (por ahora solo CRM, Ventas y pedidos), `filtros`
                           de la pantalla de inicio (se suman: activados por defecto + favoritos; "todos" va solo) y moduloActivoGuard: canActivateChild del shell, cada ruta indica `data.modulo`), permisos.ts (qué ve cada usuario según los permisos de su rol: PERMISOS_MODULO da los prefijos que abren cada módulo, PERMISOS_RUTA el permiso "ver" de cada página; ModulosService.visibles y menuDe() ocultan lo demás y moduloActivoGuard manda a /inicio; módulos sin permisos en el backend, solo root; sin permisos en la sesión (demo), todo. Al agregar una página con permiso propio, agrégala a PERMISOS_RUTA; las altas (/nueva, /nuevo) piden "crear" y van antes que su lista. Botones y acciones: `protected readonly puede = permisosSesion();` y `@if (puede('ventas.productos.editar'))`, con la clave exacta del backend (GET /permisos); sin permiso no se ofrece. VentasApi.cargar: lo que el rol no puede ver (403) llega vacío y no tumba lo demás), plantas.ts
                           (razones sociales con sus plantas y la selección: una principal + otras opcionales, nunca
                           vacía; con backend, las de la sesión (razonesDeSesion, planta = su código); sin él,
                           RAZONES_SOCIALES; fuera de componentes, razonesVigentes / plantasVigentes), mensajeria.ts (notificaciones, chats, canales y ventanas de chat abiertas; demo en
                           memoria) e historial.ts (HistorialService: el historial
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
                             Con backend: campana solo con notificaciones (GET /me/notificaciones al entrar y cada
                             60 s; leída y "Marcar todas como leídas" con PUT) y el chat oculto (conChat = false).
                           - Regla: con backend no se muestra nada de ejemplo. Los datos demo (VENDEDORES, EQUIPOS,
                             LISTAS, DEMO de lealtad, historialDemo de reportes, PERSONAS) solo existen sin AUTH_API_URL
                             (pruebas). vendedores y equipos son signals de datos.ts que VentasService llena del backend;
                             listas de precios (precios.ts) y programas (lealtad.ts) leen y escriben en su CRUD.
                           - chats.ts + ventana-chat.ts: chats abiertos abajo a la derecha; caben 3 a la vista y con
                             más la zona se desplaza de lado (row-reverse: el más reciente a la derecha). Minimizar =
                             burbuja redonda con el nombre al pasar el mouse (Esc lo oculta); Esc en una ventana la
                             minimiza. avatar-chat.ts: inicial o "#" sobre colores de la paleta oscurecidos (AA).
                           - selector-plantas.ts: como el de empresas de Odoo, plantas agrupadas por razón social; clic
                             en el nombre = solo esa, casillas = combinar.
                           - Los dos paneles son `popover` nativo (Esc, clic fuera y foco de vuelta los da el
                             navegador), colocados con `colocarBajo` (popover.ts) para no salirse de la ventana.
                           - ayuda.ts y preferencias.ts: diálogos del menú del avatar. Con backend, preferencias
                             por usuario (core/preferencias-usuario.ts: /me, /me/preferencias, /me/password; la planta
                             predeterminada se aplica al entrar). Seguridad → Dispositivos: /me/sesiones (cerrar las
                             de otros equipos; la de este es cerrar sesión). Preferencias como Odoo
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
                           aplicados como etiquetas (por defecto "Mis cotizaciones"; ui-buscador: popover
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
                           Con backend (el ERP provee AUTH_API_URL): VentasService lee todo de /api/v1 al entrar (o al
                           cambiar de usuario o empresa) y cada acción se guarda allá; sus métodos de escritura son async
                           (los que llaman muestran mensajeDe(e) si falla). ventas-api.ts traduce entre la forma de la API
                           (la del dbml) y ui/models: plantas por código (ESC ↔ id de sucursal, de la sesión), productos
                           del tarifario por código (CON-FC-300 ↔ fc-300, de lo que depende formato.ts), servicios y
                           maquinaria como líneas (SRV-…, REN-…), fechas UTC ↔ ISO con offset de la planta, descuento %
                           ↔ importe. El historial de cotizaciones, órdenes, clientes y productos viene del backend
                           (HistorialService.remoto; notas a /historial/…/notas). Sin API (pruebas, portal) sigue la demo
                           en memoria. Cotizaciones y pedidos llegan paginados ({ items, total }) con su detalle
                           (incluir=partidas / lineas); nombres de usuarios de /usuarios/resumen; el traslado inicial
                           es el de la planta (trasladoDe, de la sesión); el PDF de un borrador usa el folio de
                           /secuencias/siguiente (folioSiguiente). Actividades del historial en /actividades
                           (HistorialService.remoto: actividades, programar, cerrar; "asignada a" = usuarios de la
                           organización, HistorialService.personas). "Actividad programada / realizada / cancelada"
                           lo escribe el backend en el hilo del registro: el front solo vuelve a leerlo. shortcut: aún trae todas las cotizaciones y
                           pedidos al entrar; con volumen, pedir por periodo.
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
                           Recibidas: estado "recibida" (origen 'portal': la pidió el cliente; folio EPI-WEB), en
                           Ventas → Órdenes → Cotizaciones recibidas (/ventas/cotizaciones/recibidas, la misma lista
                           con el filtro "Recibida"); se editan, envían o confirman como las demás y sus pasos empiezan
                           en Recibida. El editor (editor-cotizacion.ts) tiene el traslado como al crearla (distancia
                           por producto, km incluidos y $ por km). El lápiz es un botón dividido: Editar (si ya no se
                           puede, Nueva basada en esta) y, en su flecha, Nueva basada en esta (/ventas/cotizaciones/
                           nueva?base=ID: misma hoja con sus datos; queda con `baseId`) y Ocultar/Mostrar al cliente
                           (`ocultaAlCliente`; enviarla la vuelve visible). "Cotizaciones relacionadas" muestra la base y
                           las que salieron de ella, con la diferencia de neto (verde si bajó el precio).
                           Órdenes: cobro (EstadoCobro de ui: Por cobrar, Por facturar, Facturado, Crédito, Pagado,
                           Finalizado; toda orden nace "por cobrar"), método de pago (Sin método / Transferencia; al
                           crear una orden es obligatorio, al confirmar una cotización queda "sin método") y estatus
                           planta (No enviado, Enviado, Confirmado, Actualización, Rechazada). cambiar-cobro.ts: menú de
                           cobros con segunda confirmación (confirm), solo en la orden abierta (vista previa o vista
                           completa): nunca desde una lista, para que se vea la orden completa. planta-pedido.ts:
                           "Enviar requerimiento a planta" y la respuesta de planta (confirmar, pedir actualización con
                           nueva fecha y nota, rechazar con motivo); aceptar la actualización cambia la entrega y la
                           confirma. VentasService: cambiarCobro, cambiarMetodoPago, estatusPlanta (con historial).
                           por-cobrar.ts (Ventas → Por cobrar → Órdenes por cobrar, /ventas/por-cobrar): solo las
                           órdenes por cobrar, como las demás listas: casillas (una, varias o todas), vista previa con
                           clic, vista completa con doble clic; la orden que cambia de cobro sale de la lista. En Por
                           cobrar y Órdenes la columna Planta siempre a la vista (PlantaFila): sin enviar, "Enviar a
                           planta" sin abrir la orden (en Por cobrar, también las marcadas); enviada, su estatus y
                           "sin respuesta" si planta no contesta.
                           Editar orden (editor-pedido.ts, en Órdenes y Por cobrar mientras esté programada): entrega,
                           volumen, precio especial y método de pago; VentasService.editarPedido guarda su propia
                           partida (la cotización no cambia), recalcula el importe y, si ya estaba con planta y cambia
                           la entrega o el volumen, la reenvía a planta. Las listas preguntan antes de dejar una orden
                           con cambios sin guardar.
                           Productos (Ventas → Productos → Productos, /ventas/productos y /ventas/productos/:id): el
                           tarifario de ui (PRODUCTOS: concretos f´c y MR, ajustes de edad, cemento RS y aditivos,
                           servicios y renta de maquinaria, con código, unidad, precio de lista y mínimo), como las
                           demás listas: casillas, vista previa (detalle-producto.ts) y vista completa con historial.
                           Su uso: VentasService.usoDe (cotizaciones y órdenes que lo llevan, m³; partidaUsa de ui).
                           Los precios son los mismos con que se cotiza: PRECIO_SERVICIO y las tablas de formato.ts.
                           Tipos de producto (TipoProducto de ui): Concreto (lo principal), Servicio y Producto general
                           (extras: sacos de cemento…); filtro por tipo en la lista. Alta (/ventas/productos/nuevo,
                           nuevo-producto.ts) y edición (vista previa y completa) usan el mismo form-producto.ts: el
                           código no se escribe, se arma solo (servicio/general: codigoSugerido con el nombre; concreto:
                           f´c, edad, rev. y suministro con las opciones fijas de la lista de planta PRODUCTOS-ESC-XPJ
                           (OPCIONES_CONCRETO) o Personalizado → codigoConcreto "200 - N28 - 14 - BP" y nombreConcreto;
                           misma configuración que otro producto = aviso y solo como variante, codigoVariante "… - 2").
                           Descripción y unidad obligatorias (UNIDADES_PRODUCTO). Servicios: renta de equipo
                           (EquipoServicio): tipo (TIPOS_EQUIPO) y unidades conectadas de EQUIPOS, o "no conectar por
                           ahora"; shortcut: EQUIPOS es fijo de demo hasta que Flota lo administre. Generales:
                           existencias y mínimo, aviso "Pocas existencias", entradas/salidas en su detalle
                           (moverExistencias). Del tarifario (delTarifario) solo se editan nombre, descripción y equipo:
                           código, unidad y precio los usa el cotizador. El tipo no se edita. Resumen "Así quedará".
                           shortcut: los productos dados de alta aún no se agregan a cotizaciones u órdenes.
                           Listas de precios (/ventas/listas-de-precios, listas-precios.ts; precios.ts con
                           ListasPreciosService): como en Odoo, varias listas con nombre, moneda (MXN/USD) y plantas
                           (ninguna = todas; lo común, una por planta). Nueva (nueva-lista.ts) y Editar usan
                           editor-lista.ts; detalle-lista.ts (vista previa y completa, lista-precios.ts) con sus líneas:
                           "Agregar una línea" o clic abre regla-precio.ts (diálogo: aplicar a producto/todos o
                           categoría; descuento, fórmula o precio fijo; cantidad mínima; vigencia; Guardar y crear
                           nuevo). Historial en registro.lista. shortcut: aún no se aplican al cotizar.
                           Descuentos y programas de lealtad (/ventas/descuentos-y-lealtad, programas.ts; lealtad.ts con
                           ProgramasService y evaluar()): las 7 plantillas de Odoo (PLANTILLAS: promoción automática,
                           código, compra X recibe Y, cupón de la próxima orden, tarjeta de lealtad con puntos, cupones
                           únicos y tarjeta de sellos), en tarjetas en Nuevo (nuevo-programa.ts, ?plantilla=) y si no hay
                           programas. form-programa.ts (alta y edición, solo los campos de su tipo); detalle-programa.ts
                           con cupones (generar, marcar usados) y probar-programa.ts: orden de ejemplo → evaluar() dice
                           descuento, por qué y lo que gana (puntos, sellos, cupón). shortcut: aún no se aplican al
                           cotizar ni se guardan puntos/sellos por cliente.
                           Reportes (/ventas/reportes/…): piezas comunes en reporte-fuente.ts (ReporteFuente: historial
                           de demostración + órdenes del ERP, sin IVA, con nombres y precios de lista),
                           filtros-reporte.ts (periodo, plantas, producto, vendedor, cliente, comparar con el periodo
                           anterior o el año pasado; cada reporte oculta el de lo que analiza), indicadores-reporte.ts,
                           tabla-reporte.ts (ordenable, renglón elegible, pie con totales, csvDeTabla) y grafica.ts (SVG
                           propio: barras/líneas/participación, teclado y detalle). reporte-datos.ts: periodos, filtrar,
                           medir, agrupar (tabla dinámica), resumir (un renglón por entidad), variación, csv.
                           - Ventas (reporte-ventas.ts): Gráfica / Tabla dinámica / Lista, reportes rápidos.
                           - Vendedores: ranking (participación, variación, ticket, clientes, vs. lista), evolución,
                             por planta o participación, y el detalle del vendedor.
                           - Productos: concreto/servicios/todo; m³ por producto y planta (en orden de resistencia),
                             mezcla o tendencia; % de órdenes con bombeo; precio obtenido vs. lista; detalle con enlace.
                           - Clientes: cartera con estado (nuevo, recuperado, creciendo, estable, bajando, inactivo),
                             Pareto (% acumulado), días sin comprar, clientes en riesgo, concentración en los 5 mayores;
                             detalle con últimas órdenes y enlace a la ficha.
                           Colores: paleta validada del skill dataviz, fija por entidad (ORDEN_SERIE). shortcut:
                           historialDemo inventa ~3 años de ventas y CLIENTES_HISTORIAL (clientes sin ficha) hasta tener
                           backend.
                           Prueba solo en Cotizaciones: la vista previa en Liquid Glass (`liquido`). Si gusta, pasa a
                           todas.
        Soluciones             (ui/lib/cotizacion/concretos.ts) las 7 soluciones del cotizador son etiquetas de los concretos
                           f´c/MR en Productos (Producto.soluciones). Quien carga los productos llena concretosServidor
                           (ERP: VentasService; portal: ObrasService con /portal/catalogo): solucionesDisponibles() solo
                           ofrece las que tienen concretos, resistenciasDe(solucion) las de sus concretos,
                           sugeridaDisponible() ajusta la sugerida y precioConcreto toma el precio de lista del producto.
                           Sin backend, el tarifario fijo de formato.ts.
                           Vocabulario de la partida en la API: exposicion normal|humedad|marina y colocacion directa|bombeable
                           (el front dice "bombeo"; partidaApi/aPartida lo traducen). Clientes: Eliminar solo sin cotizaciones,
                           órdenes ni obras (409 del backend; el de mostrador nunca). Cotizaciones: "Cancelar cotización" en
                           el menú del lápiz (POST /cancelar); "Cotizaciones relacionadas" incluye sus revisiones (mismo folio
                           sin -R…). Público en general: lo crea la primera cotización "Sin cliente" y entra a la lista.
                           Confirmación de órdenes: una orden nace "por confirmar" (Pedido.confirmadaEn vacío;
                           porConfirmar). "Confirmar pedido" en la cotización abre confirmar-orden.ts (diálogo que recuerda
                           día y hora de cada entrega en la zona de la planta): "Crear y confirmar" (confirmarOrdenes) o
                           "Crear orden (por confirmar)". En la orden: barra Por confirmar › Confirmada › En planta…, origen
                           (cotización y la oferta que mejoró) y en el requerimiento a planta el botón dividido "Enviar
                           requerimiento a planta ▾ Confirmar orden" (mismo diálogo; POST /pedidos/{id}/confirmar,
                           permiso ventas.pedidos.confirmar). Planta al confirmar también la confirma. Orden directa:
                           casilla "Dejarla confirmada". Órdenes: filtro "Confirmación" y etiqueta "Por confirmar".
                           Calendario de entregas (calendario-entregas.ts, con pruebas): Órdenes → selector Lista /
                           Calendario (?vista=calendario); Día, Semana (lunes a domingo) o Mes (6 semanas), las mismas
                           filas filtradas (buscador y plantas), cada orden en el día y hora de su planta, órdenes y m³ por
                           día; Día y Semana son una tabla por hora como el calendario de Apple (horasVisibles: 06:00–20:00
                           ampliado a la primera/última entrega; horas vacías delgadas con su línea, las ocupadas crecen); clic = vista previa, doble clic = vista completa, "+N más" abre el día.
                           Pedido mínimo: Producto.pedidoMinimo (Productos → sección "Pedido mínimo", también en los del
                           tarifario). pedidoMinimoDe(especificacion) (ui) lo lee de concretosServidor; nueva-cotizacion,
                           editor-pedido y el cotizador del portal no dejan menos y muestran "Pedido mínimo: N m³" bajo
                           el volumen. El backend da 400 igual. Distinto de minimoCobro (ese solo cobra de más).
                           Logística (features/flota, módulo activo, menú Flota/Combustible; solo con backend):
                           flota-api.ts (FlotaApi y tipos, con pruebas): toda unidad es un Equipo (TIPOS_EQUIPO de
                           datos.ts + "otro"), categorías Transporte de concreto / Bombeo / Carga y flete / Maquinaria;
                           estado manual disponible | mantenimiento | fuera_de_servicio; "en viaje" lo calcula
                           GET /flota/tablero (con ?pedidoId= dice si choca ±4 h con la entrega y el motivo).
                           Tipo Loop4 (fase 5): Mapa de flota (/flota/viajes, viajes.ts + panel-gps.ts): todas las
                           unidades con su última posición (GET /flota/posiciones), lista en texto al lado; clic → panel
                           con sensores (tambor, motor, combustible, temperatura: textoSensores) y recorrido por rango o
                           viaje (/equipos/{id}/recorrido, /viajes/{id}/recorrido) dibujado como ruta (MapaSeguimiento
                           ahora acepta `rutas` y emite `elegir`), con reproducción y gráfica de velocidad/altitud.
                           Línea de tiempo (linea-tiempo.ts): fila por unidad, barras por viaje con etapas carga/ida/
                           obra/regreso (reales sólidas, planeadas rayadas) y mantenimientos. Indicadores
                           (indicadores.ts): KPIs, m³ por día (Grafica de Ventas), tablas por unidad/conductor/cliente/
                           vendedor y prolongados en obra (> 90 min); CSV y PDF (jsPDF). Inspecciones (inspecciones.ts):
                           checklist por tipo (GET /flota/checklist), fotos y firma (firma.ts, /archivos); una rechazada
                           bloquea la unidad. Remisión PDF y firma de recibido en cada viaje (documentos-pdf.ts). Calidad
                           y laboratorio (módulo activo, /laboratorio, laboratorio/calidad-api.ts): muestras, ensayes a
                           7/14/28 días y certificado de la orden en PDF (también desde la orden de Ventas).
                           Tablas de Logística como las de Ventas: casillas (seleccionMultiple, "N de M seleccionados"),
                           selector de plantas del encabezado (plantas-flota.ts: ids del backend ↔ códigos), clic = vista
                           previa de SOLO LECTURA con "Editar" y acciones rápidas (estado de la unidad, activar operador,
                           iniciar/terminar servicio), doble clic = vista completa; acciones para las marcadas en Unidades
                           (estado, baja) y Operadores (activar/desactivar). Marcador del menú: EnlaceModulo.contador
                           (core/contadores.ts; "Órdenes N" = sinCamion()).
                           Despacho y Órdenes: tablero-despacho.ts (columnas por estado × filas por hora como el
                           calendario; clic en el folio → previa-orden.ts a la derecha). Órdenes tiene vistas Lista /
                           Tablero por horas / Mapa (mapa-ordenes.ts: obras, plantas y camiones con GPS; ?vista=).
                           Unidades en varias plantas: Equipo.sucursalIds (principal + "También opera en"); solo se le
                           asignan órdenes de sus plantas. Recorridos (recorridos-unidad.ts, vista previa y ficha): GET
                           /equipos/{id}/resumen (trayectos, km, diésel, rendimiento, km desde la última carga) y
                           /trayectos (los de entrega los crea el back al terminar el viaje, km estimados; los manuales:
                           traslado, flete, a taller). Aviso de carga cada 7 días o 500 km (tocaCarga, Vencimientos).
                           Órdenes de logística (/flota/ordenes, Operación → Órdenes): ES la página de Ventas → Órdenes
                           (ventas/ordenes.ts) con data.logistica = true: solo las gestionables (gestionable():
                           confirmadas o en solicitud de confirmación a planta, sin entregar ni cancelar), marcador "N
                           sin camión" (filtra; asignacionDe en flota-api) y filtro Camión, y además las vistas Tablero
                           por horas y Mapa. Todo lo demás (columnas, filtros, calendario, vista previa, vista completa)
                           es lo de Ventas: un cambio en Ventas cambia los dos.
                           por correo (si clienteTieneCorreo es false pide el correo) y en su portal; quita las unidades
                           que ya no caben. Solicitar reagendar (operacion.reagenda.solicitar, planta/logística): queda
                           Pedido.reagendaPendiente hasta que Ventas acepte (avisa) o rechace; reagenda-orden también va
                           en la orden de Ventas. La "actualización" de planta crea la misma solicitud.
                           Tiempos de viaje: Producto.tiempoServicioMin (Productos → Tiempo de servicio) y
                           Pedido.tiempos { transporteMin (ida y vuelta, calculado por la distancia o escrito con
                           "Cambiar transporte"), servicioMin, totalMin }. Cada viaje ocupa la unidad de salidaProgramada
                           a regresoEstimado (textoVentana); la disponibilidad es por cruce de esas ventanas.
                           Menú: Operación (Despacho del día /flota/despacho = inicio del módulo, Viajes y mapa),
                           Flota (Unidades /flota, Operadores, Vencimientos), Control (Combustible, Mantenimiento);
                           /combustible redirige. Las listas siguen CAJAS_LISTA: UNA sola caja dentro de la columna
                           (resúmenes y avisos van dentro de la caja; si no, columna-caja desacomoda la tabla).
                           /flota: tabla + vista previa con form-unidad.ts (alta/edición, operador habitual del
                           catálogo, GPS = uniqueId de Traccar); doble clic → ficha completa /flota/unidades/:id
                           (unidad.ts: cifras, datos, documentos-unidad.ts, viajes recientes, combustible,
                           mantenimiento, historial registro 'equipo:ID'). despacho.ts: kanban del día
                           (columnasDespacho: Por asignar + estados del viaje), asignar y avanzar sin abrir la orden,
                           refresco 30 s. operadores.ts (licencia y vencimiento), vencimientos.ts (GET
                           /flota/vencimientos), combustible.ts (rendimientos km/L o L/h; el odómetro no baja),
                           mantenimiento.ts (Programado › En proceso › Terminado / Cancelado; en proceso = unidad en
                           taller). ?unidad=ID filtra combustible y mantenimiento.
                           /flota/viajes: unidades en viaje, mapa (posiciones de Traccar, refresco 30 s) y órdenes
                           confirmadas que aún necesitan unidad. En la orden (viajes-pedido.ts, permisos
                           operacion.remisiones.*): "Asignar unidad" (flota/asignar-unidad.ts, el mismo en el despacho:
                           unidad disponible, operador del catálogo u "Otro", m³ si es olla, método de pago) →
                           POST /pedidos/{id}/viajes; cada viaje avanza Programado › Cargando › En ruta ›
                           En obra › Regresando › Terminado (solo hacia adelante) y el backend mueve el estado del pedido;
                           "Quitar" solo en Programado. Solo las ollas suman m³; bombas y demás acompañan la orden.
                           Traccar se configura en el backend (Traccar__Url/Traccar__Token); sin eso, posiciones null.
                           MetodoPago: sin_metodo, transferencia, efectivo, tarjeta, cheque. Portal: viaje "programado" =
                           "Unidad asignada".
                           Negociación: "Mejorar oferta" (menú del lápiz, recibida o enviada vigente) abre la hoja con
                           ?base=ID&oferta=1 (reemplazaId); el resumen compara contra la oferta anterior. Al ENVIARLA, la
                           anterior queda reemplazadaPorId (backend): no se envía, confirma ni acepta, aviso "Oferta
                           reemplazada", etiqueta en la lista, filtro "Negociación" y fuera del total; en el portal, "Te
                           enviamos una mejor oferta". Cancelar la nueva devuelve la anterior. Un borrador no reemplaza.
                           Crédito (credito-cliente.ts en la ficha): Cliente.credito { limite, dias } (API limiteCredito,
                           diasCredito); creditoDe: usado = órdenes en cobro "Crédito", vence = creditoDesde + días;
                           cambiar-cobro revisa sinCreditoPara antes (el backend da 409). Portal: Mi perfil muestra el
                           disponible (/portal/perfil.credito).
                           Cuenta del portal (cuenta-portal.ts, en la ficha del cliente, solo con backend y nunca para el
                           de mostrador): un cliente puede tener o no un usuario del portal (Tipo Portal: el backend no lo
                           deja entrar al ERP). "Crear cuenta y enviar credenciales" (POST /clientes/{id}/cuenta-portal:
                           el backend manda la contraseña temporal por correo y nunca la devuelve), reenviar credenciales
                           y activar/desactivar. También al dar de alta: Clientes → Nuevo, casilla "Darle acceso al
                           portal" (usa el correo del contacto; el aviso llega a la ficha por el state de la navegación).
                           Quien tiene ventas.clientes.crear o .editar crea la cuenta; reenviar, desactivar y límites
                           piden editar. Desde Ventas solo se crean usuarios del portal, nunca internos ni con permisos
                           del ERP. Si el correo ya es de un contacto del cliente, la cuenta es de ese contacto
                           (contactoId). Límites del portal (Cliente.limites; API limiteCotizaciones/limiteObras,
                           null = sin límite): solo lo que el cliente crea en el portal; el backend da 409 al pasarse y el
                           portal lo avisa antes (PerfilService.tope con /portal/perfil.limites: deshabilita "Agregar
                           obra" y guardar una cotización nueva; una revisión -R no cuenta; descargar sí se puede).
                           Aditivos: también son productos (tipo/categoría "aditivo", código AJ-ADT-{CLAVE}; en la API tipo
                           concreto). aditivosServidor (lo llenan VentasService y ObrasService) → aditivosDisponibles() en los
                           dos cotizadores; la partida guarda la clave en minúsculas (fibra-sintetica) y su precio por m³ se
                           suma al concreto. Se dan de alta y se editan (nombre, descripción, precio) en Productos; su código
                           nunca cambia. Sin backend, los 5 de siempre (ADITIVOS).
                           Primero se elige cómo: Producto (un concreto de la lista), Solución o Configurar manual (ERP:
                           segmentos en cada producto de nueva-cotizacion.ts; portal: tarjetas del paso 1, manual va directo a
                           especificaciones). A mano, concretoExistente(tipo, kg) avisa "Este producto ya existe" con "Usar el
                           producto"; si no existe es pedido especial (PartidaCotizacion.especial, API `especial`): se guarda
                           sin tarifa, lineasPartida lo pone en $0 "precio por confirmar" y Ventas escribe su precio en el
                           editor; el backend no deja enviar, confirmar ni aceptar sin él. Una orden directa lo pide al crear.
        Lugar de entrega       una cotización (y sus pedidos) va a una obra O a un lugar de entrega capturado solo para ella
                           (Cotizacion.lugar / Pedido.lugar: dirección, municipio, referencias, GPS, quién recibe; en la
                           API entrega* + contactoNombre/Telefono y obraId null). No crea obras. Sus partidas apuntan a
                           idLugar(id) y las vistas lo ven como obra de solo lectura (obraDelLugar, VentasService.destinos);
                           la sección Obras y los conteos usan solo VentasService.obras. En la nueva cotización, con lugar
                           los productos no eligen obra (LUGAR); el selector de obras incluye las generales.
        features/ventas/obras.ts  Ventas → Órdenes → Obras (/ventas/obras, /nueva?cliente=, /:id): posiciones de entrega de un
                           cliente o generales (Obra.clienteId '' = general; en la API null). CRUD en /obras (permisos
                           ventas.obras.*; borrar da 409 si la usan cotizaciones o pedidos, y el botón se deshabilita),
                           historial propio 'obra:'+id. editor-obra.ts = cliente + el formulario de obra compartido
                           (ui/lib/obras/obra-form.ts, el mismo del portal, con mapa, responsable y contactos).
        features/configuracion/ módulo Seguridad y plataforma (/configuracion → /configuracion/usuarios; menú "Usuarios y
                           compañías" como Ajustes de Odoo; Empresas y Plantas en construcción). Todo en el backend
                           (acceso.ts: AccesoService; sin API, listas vacías). Usuarios (usuarios.ts, detalle-usuario.ts,
                           usuario.ts, nuevo-usuario.ts, form-usuario.ts): lista con vista previa y vista completa con
                           historial; alta con /usuarios/alta (datos, contraseña inicial opcional, su rol —uno solo, en el
                           usuario: Usuario.rolId— y accesos: empresa, planta o todas y predeterminado, sin rol) y edición
                           con PUT /usuarios/{id} (manda siempre el rolId) + /usuarios/{id}/accesos;
                           asignar contraseña (también desbloquea), activar/desactivar (no a sí mismo) y sus sesiones
                           (/sesiones?usuarioId, cerrar). Roles (roles.ts, detalle-rol.ts, rol.ts, nuevo-rol.ts,
                           form-rol.ts): /roles/resumen (permisos y accesos que lo usan) y matriz de permisos por módulo y
                           recurso con el catálogo de GET /permisos; PUT /roles/{id}/permisos reemplaza todo. Reglas (con
                           pruebas): `tiene` (exacta, "*", "modulo.*", "modulo.recurso.*", como el backend), solo se dan
                           o quitan los permisos que uno tiene, "Acceso total" solo root, roles del sistema solo root,
                           desmarcar algo cubierto por un comodín lo cambia por sus claves (alternarClave). Eliminar un
                           rol solo si nadie lo usa. shortcut: usuario.ts y rol.ts crean VentasService para conectar el
                           historial del backend. Permisos por usuario: el rol es la plantilla y cada usuario guarda solo
                           la diferencia (AjustesUsuario: agregados y quitados; efectivos = rol + agregados − quitados,
                           `permitido`/`ponerPermiso`); GET/PUT /usuarios/{id}/permisos, también en /usuarios/alta. La
                           matriz es matriz-permisos.ts (la comparten form-rol.ts y permisos-usuario.ts); en la ficha,
                           sección Permisos; en el alta, precargada con el rol. Servidores de correo (servidores-correo.ts, menú "Plataforma"): CRUD de
                           /servidores-correo; password solo de entrada (null conserva, "" borra; vuelve tienePassword),
                           "Probar conexión" (POST {id}/probar) y, para root, el global (404 = no hay).
        ui/src/lib/auth/restablecer.ts  página /restablecer de ERP y portal: sin ?token pide el correo (POST /auth/olvide,
                           siempre 204); con el token del correo pide la nueva (POST /auth/restablecer; 400 = enlace
                           vencido o usado). Sin AUTH_API_URL (portal hoy) solo muestra un aviso.
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
                           dirección y GPS) y ChatService (atención al cliente).
                           Con backend (AUTH_API_URL '/api/v1', proxy projects/portal/proxy.conf.json, apiInterceptor
                           de ui) todo es de /api/v1/portal/** y del cliente de la sesión (sesion.cliente):
                           obras, catálogo (sus plantas → plantasServidor de ui, que usa plantaPara: la más cercana a
                           la obra), cotizaciones (cotizacionApi/aCotizacion de ui/api/ventas, las mismas del ERP; el
                           folio y los precios los pone el backend), aceptar, diseños, pedidos (pedidos-api.ts) con sus
                           viajes (SeguimientoService, sondeo cada minuto, sin GPS), remisiones, perfil (la empresa es
                           de solo lectura), datos fiscales y sus documentos (/portal/archivos). Sin backend (pruebas),
                           todo de ejemplo en memoria. El chat con el asesor se oculta (no existe en el backend).
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
                           Estado del ERP (CotizacionGuardada.estado) con palabras del cliente (ESTADO_PARA_CLIENTE:
                           En revisión, Respondida, Aceptada, Cancelada); guardar = "recibida" y aceptar = "pedido",
                           como los ve Ventas. No se listan las ocultas ni los borradores del ERP (visibleAlCliente);
                           una cancelada no se acepta.
                           cotizacion.ts (/cotizaciones/:folio): detalle con flujo y "Aceptar y generar pedido".
        features/obras/    Mis obras y obra.ts (/obras/:id). obra-form: alta y edición (lo usa también el cotizador) con
                           responsable (nombre + foto opcional) y contactos (lada +52 por defecto, extranjeros 6–14
                           dígitos; telefono.ts con pruebas). Una obra con pedido en curso no se edita
                           (PedidosService.obraConPedidoEnCurso).
        features/pedidos/  Mis pedidos: totales (total, pagado, pendiente), tabla con hover; clic = vista previa a la
                           derecha (pedido-previa), doble clic o el folio = abre el pedido, la obra enlaza a /obras/:id.
                           Pedido.cobro: EstadoCobro de ui, el mismo del ERP (pagado y finalizado cuentan como
                           pagados en los totales) + importe y facturaFolio.
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
      auth/                AuthService, authGuard, guestGuard, destinoSeguro, AUTH_STORAGE_KEY, AUTH_API_URL, ErrorAuth.
                           Con AUTH_API_URL (el ERP: /api/v1) el login, refresh y logout van al backend; sin ella (el
                           portal, mientras el backend no tenga usuarios de portal) el login es de demostración.
                           En dev, /api pasa por projects/erp/proxy.conf.json a http://localhost:5157.
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
                           plantas.ts: `plantaPara` (planta por municipio de la obra, con su contacto: ESC, XPJ, CZM y
                           CUN, las del ERP; otro municipio → GEN) y `fechaLarga`.
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
- Cada app manda `app` en /auth/login (AUTH_APP de ui: "erp" por omisión, el portal provee "portal"): el backend no deja
  entrar a un usuario del portal en el ERP ni al revés (403 con su mensaje). El ERP además rechaza una sesión con `cliente`.
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

- `ui-buscador`: el buscador de TODA lista o tabla (ERP y portal). Regla: ningún filtro fuera de la barra de búsqueda
  (ni botones, ni segmentos, ni filtros en los encabezados de columna). Filtros por columna: un `GrupoFiltro` por cada
  columna que lo amerite, en el panel del botón de filtros: categorías con casillas y conteo (`opcionesDe(filas, valor)`;
  se suman, ninguna = todas; `pasaFiltro`), fechas y montos con `rango: 'fecha' | 'numero'` (desde/hasta; `enRango`), sí/no
  como dos casillas. Nombres, folios, RFC o teléfonos no llevan filtro: los cubre el texto. Un grupo con una sola opción
  no se muestra. Los activos van como etiquetas con × en la barra; "Quitar filtros" en el panel. Uso:
  `<ui-buscador idBuscar="buscar-x" etiqueta="Buscar …" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />`.
  Cotizaciones abre con vendedor = el usuario ("Mis cotizaciones") y Recibidas con estado Recibida. Lo usan todas las
  listas del ERP (Ventas y Seguridad), la cartera del reporte de Clientes y Mis pedidos y Remisiones del portal.
  `colocarBajo` (popovers bajo su botón) vive aquí.
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
- `.github/workflows/frontend-erp.yml` / `frontend-portal.yml`: con push a `develop`/`main` que toque esa app (o
  `ui`, dependencias, Dockerfile) construyen SOLO esa imagen (`ghcr.io/<usuario>/epico_erp-erp|-portal`, etiquetas
  `develop`/`latest` y `sha-…`) y la despliegan por SSH en el VPS (lógica en `frontend-app.yml`).
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
