# EPICO API

.NET 10 + PostgreSQL. Esquema acordado: [docs/esquema.dbml](docs/esquema.dbml).

## Correr en local

```bash
docker compose up -d database                  # desde la raíz del repo
cd Backend
dotnet tool restore
dotnet run --project src/EPICO.Api -- --migrate   # migraciones + seed (se puede repetir)
dotnet run --project src/EPICO.Api                # http://localhost:5157 · docs en /scalar
dotnet test                                       # necesita el Postgres de arriba (o EPICO_TEST_DB)
```

`src/EPICO.Api/appsettings.Development.json` (no se sube a git) lleva la configuración local:

```json
{ "Jwt": { "Key": "<32+ caracteres>" } }
```

## Configuración (variables de entorno en el VPS)

| Variable | Para qué |
|---|---|
| `ConnectionStrings__Default` | Cadena de Postgres |
| `Jwt__Key` | Llave para firmar los JWT, 32+ caracteres. Sin ella la API no arranca |
| `Seed__RootPassword` | Contraseña del usuario inicial al crearlo con `--migrate` (vacía = `EpicoERP1.`). Si ya existe, no se cambia |
| `Seed__RootCorreo` | Correo del usuario inicial (por defecto `admin@epyco.cloud`) |
| `Archivos__Ruta` | Carpeta de los archivos subidos. La imagen usa `/data/archivos`: monta ahí un volumen |
| `Docs__Enabled` | `true` publica `/scalar` y `/openapi/v1.json` fuera de Development |
| `Cors__AllowedOrigins__0` | Origen del front si no va por el mismo dominio |
| `Cifrado__Llave` | 32+ caracteres; cifra las contraseñas de los servidores de correo. **No la cambies** después (habría que recapturarlas) |
| `Correo__Host`, `__Puerto` (587), `__Seguridad` (`StartTls`/`Ssl`/`Ninguna`), `__Usuario`, `__Password`, `__Remitente` | Servidor de correo global (SMTP). Sin `Host` no se envía nada |
| `Correo__UrlErp`, `Correo__UrlPortal` | Base de los enlaces de los correos (`…/restablecer?token=…`) |
| `Traccar__Url`, `Traccar__Token` | GPS de flota (Traccar, token Bearer). Sin los dos no hay posiciones y `gps.configurado` es `false`. En local con `dotnet user-secrets`; **nunca en appsettings** |

Nueva migración: `dotnet ef migrations add <Nombre> -p src/EPICO.Infrastructure -s src/EPICO.Api -o Persistence/Migrations`.

## Documentación (OpenAPI)

En Development (o con `Docs__Enabled=true`): UI en `/scalar` (botón *Authenticate* → pega el `token` del login) y el JSON en `/openapi/v1.json`.
Cada endpoint trae su permiso, sus filtros y sus respuestas 401/403; los textos salen de los comentarios `///` del código.
Copia sin servidor: [docs/openapi.json](docs/openapi.json) (se importa en Postman, Insomnia o editor.swagger.io).
Si cambian los endpoints, regénerala con la API corriendo:

```bash
curl -s http://localhost:5157/openapi/v1.json | python -m json.tool --no-ensure-ascii > docs/openapi.json
```

## Usuario inicial y roles

`--migrate` crea `admin@epyco.cloud` (contraseña `EpicoERP1.` salvo `Seed__RootPassword`; **cámbiala al entrar** con
`PUT /api/v1/me/password`) con el rol Root y acceso a las dos empresas, y cinco roles del sistema:

| Rol | Permisos |
|---|---|
| Root | `*`: todo, sin filtro por empresa |
| Administrador | `config.*`, `general.*`, `ventas.*`, `crm.*`, `inventario.*`, `flota.*`, `operacion.*` |
| Ventas | `ventas.clientes.*`, `ventas.cotizaciones.*`, `ventas.pedidos.*`, `crm.*`, `general.*`, `operacion.remisiones.ver/crear/editar` y ver productos, listas de precios, programas, existencias, equipos y operadores |
| Logística | `flota.*` (equipos, operadores, combustible, mantenimiento), `operacion.*`, `ventas.pedidos.ver`, `ventas.clientes.ver` |

Los permisos de un rol se ponen solo al crearlo: lo que cambies desde la pantalla de roles no se pisa en el siguiente deploy.
Un permiso puede ser exacto (`ventas.cotizaciones.enviar`) o un comodín de módulo o recurso (`ventas.*`, `ventas.clientes.*`).

## Datos de demo (solo desarrollo)

```bash
dotnet run --project src/EPICO.Api -- --migrate --demo   # o Seed__Demo=true
```

Crea la empresa **Concretos Demo S.A. de C.V.** (plantas DMA Planta Norte, Mérida, y DMB Planta Sur, Campeche, con
traslado distinto) y le da acceso a `admin@epyco.cloud`. Trae un registro de cada opción: cotizaciones por estado y origen,
pedidos por estado, cobro, método de pago y estatus de planta, un viaje en cada estado, prospectos por etapa, actividades,
notas, una lista de precios con los tres tipos de regla, un programa por tipo y equipos de cada tipo (con marca, modelo y
operador; la retroexcavadora en mantenimiento). `CON-FC-200` lleva pedido mínimo de 3 m³. Logística (también se agrega a
una demo existente si sus plantas no tienen operadores): 4 operadores (uno con la licencia vencida), seguros y tarjetas (uno
vencido, una verificación que vence en 10 días), 6 cargas de diésel de 2 ollas y un mantenimiento programado y otro en proceso.
Si la empresa demo ya existe no hace nada; para regenerarla, borra la base. **No lo actives en producción.**

Todos con la contraseña `Demo.Epico1`:

| Correo | Qué es |
|---|---|
| `root@demo.epyco.cloud` | Root |
| `admin@demo.epyco.cloud` | Administrador |
| `ventas@demo.epyco.cloud` | Ventas (vendedora de los clientes y actividades) |
| `norte@demo.epyco.cloud` | Ventas, solo Planta Norte |
| `inactivo@demo.epyco.cloud` | Inactivo: el login da 401 |
| `bloqueado@demo.epyco.cloud` | Bloqueado por un admin: el login da 403 "Tu cuenta está bloqueada…" |
| `cliente@demo.epyco.cloud` | Portal, contacto de Constructora Peninsular Demo (obras Torre Altabrisa con GPS y Bodega Umán; límites 5 cotizaciones y 3 obras) |

## Correo saliente

Como en Odoo: hay un servidor **global** (variables `Correo__*`, para los correos del sistema como el reset de
contraseña) y cada organización puede dar de alta sus **servidores de correo** (`/api/v1/servidores-correo`). Un correo
de una organización sale por su servidor activo de menor `prioridad`; si no tiene, por el global.

- La API solo encola (`CorreoSaliente`); un proceso en segundo plano envía cada 10 s y reintenta hasta 5 veces
  (2, 4, 8, 16 min). Los que no salen quedan `fallido` con el error.
- La contraseña SMTP de un servidor solo entra (`password`); se guarda cifrada y la API devuelve `tienePassword`.
- En local, `docker compose up -d mailpit` atrapa los correos (SMTP `localhost:1025`, se ven en http://localhost:8025).
  `appsettings.Development.json` necesita `"Correo": { "Host": "localhost", "Puerto": 1025, "Seguridad": "Ninguna",
  "Remitente": "EPICO <no-responder@epyco.cloud>" }` y `"Cifrado": { "Llave": "<32+ caracteres>" }`.
- En el dominio del remitente hay que dar de alta SPF, DKIM y DMARC del proveedor, o los correos caen en spam.

## Portal de clientes

Un usuario `Tipo=Portal` entra con el mismo `/auth/login` mandando `app: "portal"` (sin `app`, o con `"erp"`, solo entran
los internos: 403 cruzado) si un `ClienteContacto` lo liga a un cliente (si no, 403).
Su token lleva el claim `cli` y la organización y empresas de su cliente, sin permisos de rol. Un candado en
`Program.cs` lo deja usar solo `/api/v1/portal/**`, `/api/v1/me/**` y `/api/v1/auth/**`, y a los internos les cierra
`/portal`. Cada endpoint del portal filtra por su cliente:

| Endpoint | Notas |
|---|---|
| `GET`/`PUT /portal/perfil` | Usuario + cliente que representa (el cliente es de solo lectura) + `limites { cotizaciones, obras, cotizacionesUsadas, obrasUsadas }` |
| `/portal/datos-fiscales`, `/portal/obras`, `/portal/disenos` (CRUD) | `clienteId` lo pone el back. Obra con pedido en curso no se edita (409) |
| `POST /portal/archivos` · `GET /portal/archivos/{id}` · `GET /portal/archivos/registro/{tipo}/{id}` · `DELETE` | Solo de registros suyos: Cliente, ClienteDatoFiscal, Obra, Usuario |
| `GET /portal/catalogo` | Productos, categorías, unidades, su lista de precios con reglas, plantas e IVA |
| `GET /portal/cotizaciones` · `GET /{id}` · `POST` · `POST /{id}/aceptar` | Sin borradores ni ocultas. El POST entra "recibida" con precios de tarifa (ignora los del cliente) |
| `GET /portal/pedidos` · `GET /{id}` · `GET /portal/remisiones` | Con obra, planta, cobro y viajes |

**Límites** (`Cliente.limiteCotizaciones` / `limiteObras`, null = sin límite): solo frenan lo que el cliente crea en el
portal (409 "Llegaste al límite de N …"). Cuentan las series de cotizaciones de origen portal no canceladas (una
revisión no cuenta aparte) y todas sus obras. En el ERP no hay límite.

**Cuenta del portal** (desde la ficha o el alta del cliente), en `/api/v1/clientes/{id}/cuenta-portal`. `GET` y `POST` piden
`ventas.clientes.crear` o `.editar`; `/reenviar` y `/activa`, `.editar`. El usuario siempre es Portal, sin rol, accesos ni permisos:

| Endpoint | Notas |
|---|---|
| `GET` | `{ usuarioId, contactoId, correo, nombre, activa, ultimoAcceso }`; 404 si no tiene |
| `POST { contactoId? , correo?, nombre? }` | Crea el usuario Portal ligado al contacto (o a uno nuevo) y manda por correo una contraseña temporal; 201 con lo del GET + `correoEnviado`. 409 ya tiene cuenta / correo de otro usuario / público general; 400 sin correo |
| `POST /reenviar` | Contraseña temporal nueva, cierra sesiones, desbloquea; `{ correoEnviado }`. 409 si está desactivada |
| `PUT /activa { activa }` | Desactivar cierra sus sesiones. 204 |

La contraseña nunca sale en la respuesta. Los usuarios del portal no aparecen ni se tocan en `/usuarios` (404), no
reciben `/usuario-accesos` (403) y el `tipo` de un usuario no se cambia por la API (el alta de `/usuarios` siempre es interno). Borrar un cliente que solo
tiene cuenta del portal se permite y la cuenta queda desactivada.

## Negociación y crédito

**Mejorar oferta:** `POST /cotizaciones` con `reemplazaId` (del mismo cliente, si no 400; en pedido o cancelada, 409
"Esa cotización ya no se puede negociar."). Sin `baseId`, la base es esa misma. Mientras es borrador no reemplaza nada.
Al **enviarla**, la anterior queda con `reemplazadaPorId` (su estado no cambia) y ya no se envía, confirma ni acepta en
el portal (409 "Esta oferta fue reemplazada por {folio}."). Si la oferta nueva se cancela, la anterior vuelve a valer.
Las dos quedan anotadas en el historial. El portal no puede mandar `reemplazaId` (se ignora).

**Crédito:** `GET /clientes/{id}/credito` → `{ limite, dias, usado, disponible, pedidos: [{ id, folio, importe, desde, vence, vencido }] }`.
Usado = total con IVA de sus pedidos no cancelados con cobro `credito`, de todas las razones sociales. Pasar el cobro de un
pedido a `credito` da 409 si el cliente no tiene límite o no le alcanza. `Pedido.creditoDesde` se fija al entrar a
crédito y se borra al salir; vence a los `diasCredito` del cliente. `GET /portal/perfil` trae `credito` sin la lista.

**Confirmación de órdenes:** un pedido nace "por confirmar" (`confirmadaEn` null). `POST /pedidos/{id}/confirmar`
(permiso `ventas.pedidos.confirmar`) lo confirma (409 si ya lo está o está cancelado) y anota "Orden confirmada (entrega
dd/MM/yyyy HH:mm)" con la hora de la planta. Se confirma solo cuando la planta queda en `confirmado`. Nacen confirmados
con `POST /cotizaciones/{id}/confirmar { confirmarOrdenes: true }` o `POST /pedidos { …, confirmada: true }` (los dos
piden también `ventas.pedidos.confirmar`); los que acepta el cliente en el portal, nunca. El seed asegura en los roles
del sistema Ventas y Administrador `ventas.pedidos.confirmar`, `ventas.cotizaciones.confirmar`, `ventas.pedidos.planta` y
`ventas.clientes.crear` (y `operacion.remisiones.ver/crear/editar`, `flota.equipos.ver`, `flota.operadores.ver`,
`ventas.pedidos.reagendar`, `operacion.reagenda.solicitar`; en Logística, los dos de reagenda): si ningún permiso del rol los
cubre (exacto o comodín) los agrega; no quita nada ni toca roles hechos a mano.

## Flota y viajes

`Equipo`: tipo (concreto, bombeo, carga y maquinaria: `revolvedor`, `bomba_pluma`, `volteo`, `pipa`, `retroexcavadora`…),
`marca`, `modelo`, `anio`, `capacidad` + `unidadCapacidad` (`m³`, `t`, `m`, `L`; la `capacidadM3` de antes pasó a
`capacidad` en m³), `estado` (`disponible`, `mantenimiento`, `fuera_de_servicio`), `operadorNombre` (el habitual),
`gpsId` (uniqueId en Traccar, único) y `notas`.

Una remisión es un viaje: `programado` (asignado) → `cargando` → `en_ruta` → `en_obra` → `regresando` → `terminado`.

| Ruta | Permiso |
|---|---|
| `GET /flota/tablero?pedidoId=` → `{ gps: { configurado }, equipos: [{ equipo, plantaNombre, viaje, disponible, motivo, posicion }] }` | `flota.equipos.ver` o `ventas.pedidos.ver` |
| `GET /flota/gps` → `{ configurado, dispositivos: [{ uniqueId, nombre, estado, ultimaPosicion, equipoId }] }` | `flota.equipos.ver` |
| `GET /pedidos/{id}/viajes` | `ventas.pedidos.ver` u `operacion.remisiones.ver` |
| `POST /pedidos/{id}/viajes` `{ equipoId, operadorNombre?, volumenM3, metodoPago? }` | `operacion.remisiones.crear` |
| `DELETE /pedidos/{id}/viajes/{viajeId}` (solo programado) | `operacion.remisiones.editar` |
| `POST /viajes/{id}/estado` `{ estado }` (solo hacia adelante) | `operacion.remisiones.editar` |
| `GET /flota/despacho?fecha=YYYY-MM-DD&sucursalId=` → `[{ pedido, viajes }]`: órdenes no canceladas de ese día (en la hora de su planta), por confirmar incluidas | `operacion.remisiones.ver` o `ventas.pedidos.ver` |
| `GET /equipos/{id}/viajes?desde&hasta&pagina&tamano` → `{ items: [{ viaje, pedidoId, pedidoFolio, clienteNombre, obraNombre, fechaHoraEntrega }], total, resumen: { viajes, m3, ultimoViaje } }` | `flota.equipos.ver` |
| `GET /flota/vencimientos?dias=30` → documentos, licencias y mantenimientos programados vencidos o por vencer | `flota.equipos.ver` |
| CRUD `/operadores` (licencia: número, tipo, `licenciaVence`) | `flota.operadores` |
| CRUD `/equipo-documentos?equipoId=` (`seguro`, `verificacion`, `tarjeta_circulacion`, `permiso_sct`, `tenencia`, `otro`; `vence`, `archivoId`) | `flota.equipos` |
| CRUD `/cargas-combustible?equipoId=&desde=&hasta=` (odómetro y horómetro no bajan de las cargas anteriores ni pasan a las siguientes, 400; actualizan `ultimoOdometroKm`/`ultimoHorometro` del equipo) | `flota.combustible` |
| CRUD `/mantenimientos?equipoId=&estado=` (nace `programado`) · `POST /mantenimientos/{id}/estado` `{ estado }` | `flota.mantenimiento` |

- Tiempos: cada viaje ocupa la unidad de `salidaProgramada` a `regresoEstimado` (transporte de ida y vuelta + servicio).
  Transporte = `Pedido.tiempoTransporteMin` o, si es null, la distancia (la del traslado de su partida, que ya es por carretera,
  o la línea recta de la planta a la obra/lugar × 1.3) × 2 a 40 km/h, redondeado a 5 min, mínimo 30; sin distancia, 60. Servicio de la olla = `tiempoServicioMin`
  del concreto (60 sin dato); de otra unidad, el del producto del pedido con su `equipoTipo` (120 sin dato). La olla sale a la
  mitad del transporte antes de la entrega (`salidaProgramada` se puede indicar al asignar). `PUT /pedidos/{id}/tiempos
  { transporteMin }` (null = calculado; `operacion.remisiones.editar` o `ventas.pedidos.editar`) recalcula los viajes programados.
- Disponible sin `pedidoId`: activo, en estado `disponible` y sin viaje sin terminar ("En mantenimiento", "Fuera de
  servicio", "En viaje PED-…"). Con `pedidoId`: ocupado si la ventana del viaje se cruza con la de otro viaje sin terminar
  ("Ocupado con PED-… de HH:mm a HH:mm", hora de la planta; viajes viejos sin ventana: ±4 h de su entrega, "… a las HH:mm");
  los que ya van en la orden, "Ya va en esta orden". Se asigna a órdenes confirmadas o enviadas a planta (enviado/actualización).
- Asignar pide la orden confirmada, no cancelada ni entregada (409), el equipo disponible (409 con el motivo) y, si es
  revolvedor (olla), que los m³ de sus ollas no pasen del concreto de la orden (400 "Quedan X m³ por asignar"). Bombas y
  demás unidades acompañan toda la orden: su `volumenM3` no se valida ni suma. Operador vacío = el habitual.
- Al avanzar: `salidaEn` (en ruta), `llegadaEn` (en obra), `terminadaEn`; la orden toma el estado del viaje sin terminar más
  avanzado (cargando → `en_planta`, `en_ruta`, `en_obra`) y con todos terminados y los m³ de las ollas completos pasa a `entregado`.
- Plantas: `Equipo.sucursalIds` (uuid[]) = donde opera, siempre con la principal (`sucursalId`); se ve si se ve alguna. Con
  `pedidoId`, "No opera en {planta}" (después de fuera de servicio y antes de documento vencido). El tablero trae `plantaNombres`.
- Trayectos: CRUD `/trayectos?equipoId=&desde=&hasta=` (`flota.trayectos`): `entrega | traslado | flete | mantenimiento | otro`,
  con los dos odómetros `km` = fin − inicio (400 si baja). Al terminar un viaje se crea uno `entrega` con `kmEstimado` (ida y
  vuelta por carretera), uno por viaje.
- `GET /equipos/{id}/resumen?desde&hasta` (30 días por omisión): trayectos, km, km estimados, viajes, m³, litros, costo,
  `rendimientoKmL`, `ultimaCarga`, `ultimoOdometroKm`, `kmDesdeUltimaCarga`.
- Combustible: ollas, bombas y unidades de carga deben registrar carga y odómetro cada 7 días o 500 km (constantes en
  `FlotaServicio`). Salen en `/flota/vencimientos` (tipo `combustible`) y un job diario (07:00 hora de México) avisa en el ERP a
  quien tenga `flota.combustible.crear`, una vez por unidad y día. `Flota__AvisosCombustible=false` lo apaga.
- Despacho: `pedido.ubicacion` (obra o lugar) y `pedido.plantaUbicacion`.
- GPS histórico (`PosicionEquipo`): un job guarda cada 30 s la posición nueva de cada dispositivo vinculado (`Flota__GuardarPosiciones=false`
  lo apaga). Sensores normalizados en `atributos`: `tamborRpm`, `tamborSentido` (carga|descarga|detenido), `motorEncendido`,
  `combustiblePct`, `temperaturaC` y el resto en `otros` (claves de Traccar reconocidas en `Sensores`). `GET /flota/posiciones`
  (última de cada unidad, ≤ 7 días), `GET /equipos/{id}/recorrido?desde&hasta` (12 h por omisión, máximo 7 días, ≤ 2000 puntos) y
  `GET /viajes/{id}/recorrido`, con resumen: km (solo tramos en movimiento, sin saltos de más de 150 km/h), velocidad máxima y
  promedio en movimiento, minutos en movimiento y detenido.
- Inspecciones: CRUD `/inspecciones?equipoId=&desde=&hasta=` (`flota.inspecciones`); `GET /flota/checklist?tipo=` da la lista fija
  por categoría (olla, bomba, carga, maquinaria) con sus críticos. La API calcula `resultado`: crítico no ok → `rechazada`, otro no ok →
  `con_observaciones`, si no `aprobada`. Una rechazada posterior al último mantenimiento terminado deja la unidad no disponible
  ("Inspección rechazada el dd/mm/aaaa", después de mantenimiento y antes de documentos). Documento `calibracion` (vence como los demás).
- Remisión: `GET /viajes/{id}/remision` (`operacion.remisiones.ver` o `ventas.pedidos.ver`) da los datos para imprimirla (empresa,
  planta, cliente, obra, producto, m³ del viaje y acumulado del pedido, unidad, operador, horas reales, sello y firma);
  `POST /viajes/{id}/firma { archivoId, recibeNombre }` (`operacion.remisiones.editar`).
- `GET /flota/indicadores?desde&hasta&sucursalId=` (`operacion.remisiones.ver`; 30 días por omisión, por entrega del pedido): totales,
  por unidad, conductor, cliente, vendedor y día, y prolongados (más de 90 min en obra). Ciclo = terminadaEn − (cargandoEn ?? salidaEn).
- Viajes: `cargandoEn` y `regresandoEn` se ponen al avanzar (y los que falten al saltar estados).
- `GET /flota/linea-tiempo?fecha&sucursalId=` (`flota.equipos.ver` u `operacion.remisiones.ver`): por unidad activa, sus viajes de
  órdenes de ese día con etapas carga · ida · obra · regreso (reales con los timestamps, la en curso hasta ahora; lo demás planeado:
  carga 15 min antes de la salida, ida y regreso = transporte/2, obra = servicio) y sus mantenimientos.
- Mantenimiento: `en_proceso` (desde programado) pone `inicioEn` y la unidad en `mantenimiento` (409 si va en un viaje sin
  terminar); `terminado` pone `finEn` y la regresa a `disponible` si no le queda otro en proceso; `cancelado` solo desde programado.
- Historial de una unidad: `GET /historial/Equipo/{id}` (incluye sus documentos y mantenimientos).
- `GET /pedidos` y `GET /pedidos/{id}` traen `unidades` (números económicos de todos sus viajes), `m3Asignados` (solo ollas),
  `tiempos` `{ transporteMin, transporteCalculado, servicioMin, totalMin }`, `reagendaPendiente` y `clienteTieneCorreo`.

### Reagendar

| Ruta | Permiso |
|---|---|
| `POST /pedidos/{id}/reagendar` `{ fechaHoraEntrega, motivo, correo? }` → `{ pedido, notificadoA, quitados }` | `ventas.pedidos.reagendar` |
| `POST /pedidos/{id}/solicitudes-reagenda` `{ fechaPropuesta, motivo }` (una pendiente por pedido, 409) | `operacion.reagenda.solicitar` |
| `GET /pedidos/{id}/solicitudes-reagenda` · `GET /solicitudes-reagenda?estado=pendiente` | `ventas.pedidos.ver` u `operacion.remisiones.ver` |
| `POST /solicitudes-reagenda/{id}/aceptar` `{ correo?, fechaHoraEntrega? }` · `/rechazar` `{ nota }` | `ventas.pedidos.reagendar` |

- Reagendar avisa siempre al cliente: correo al contacto principal (o al correo del cliente) y a `correo`; 400 sin ninguno.
  También notifica a sus usuarios del portal. 409 si algún viaje ya no está programado. Los viajes programados recalculan su
  ventana y se quitan los que ya no estén disponibles (`quitados`). Si la planta ya tenía el pedido, vuelve a `enviado`
  (aceptar la fecha que propuso la planta lo deja `confirmado`). Queda en el historial con el motivo.
- La "actualización" de la planta crea una solicitud pendiente (origen `planta`); `aceptar_actualizacion` la marca aceptada.
- Avisos del ERP: a quien tenga `ventas.pedidos.reagendar` al crearse una solicitud y a quien la pidió al resolverse.
- Operador del viaje: `operadorId` (catálogo) o `operadorNombre`; sin ninguno, el habitual del equipo (`operadorId` u
  `operadorNombre`). 409 si el operador está dado de baja o "La licencia de X venció el dd/mm/aaaa." al día de la entrega.
- Documento vencido al día de la entrega (hoy, sin `pedidoId`) = no disponible: "Seguro vencido el dd/mm/aaaa" (va después
  de baja/mantenimiento/fuera de servicio y antes de ocupado). Sin `vence` no aplica.
- GPS: `GET {Traccar__Url}/api/devices` y `/api/positions` con caché de 15 s; se une por `Equipo.gpsId == uniqueId`. Llena
  `posicion` en el tablero y en los viajes sin terminar, y `lat`/`lng` de los viajes del portal.

## Laboratorio

- CRUD `/muestras?pedidoId=&remisionId=&desde=&hasta=` (`calidad.muestras`): al crearla toma folio de la secuencia `muestra` de
  la planta (MUE-ESC-26-001; se crea sola), el f'c del concreto del pedido y programa ensayes a 7, 14 y 28 días.
- CRUD `/ensayes?muestraId=&pendientes=true` (`calidad.ensayes`): se capturan `fechaEnsaye` y `resistenciaKgCm2`.
- `GET /pedidos/{id}/certificado` (`calidad.muestras.ver` o `ventas.pedidos.ver`): muestras con % de f'c, resumen a la edad de diseño
  y dictamen (`cumple` si el promedio ≥ f'c y ninguno < f'c − 35; `pendiente` sin ensayes a esa edad).
- Rol del sistema Laboratorio: `calidad.*`, `ventas.pedidos.ver`. Ventas y Logística: `calidad.muestras.ver`; Administrador: `calidad.*`.

## Reglas que aplica la API

- Todo exige `Authorization: Bearer <token>` salvo `/api/v1/auth/*` y `/health`.
- Permisos por endpoint: `{recurso}.ver|crear|editar|eliminar` según el verbo (GET/POST/PUT/DELETE), de `RolPermiso`. `*` = todos.
- Filtros globales: borrado lógico, empresas del usuario (`UsuarioAcceso`), su organización y, si en una empresa solo tiene accesos de planta, esas plantas (Sucursal, Cotizacion, Pedido y sus remisiones). Root no se filtra.
- Historial: al guardar, cada campo `[Rastreado]` que cambia queda en `Evento` + `EventoCambio`. Solo se agrega.
- Errores en formato ProblemDetails (`detail` trae el mensaje): 400 validación o referencia inexistente, 401, 403 sin permiso o empresa ajena, 404, 409 duplicado, 429 usuario bloqueado (5 intentos, 15 min).
- JSON en camelCase; los enums como en el dbml (`interno`, `fecha_hora`…).

## Endpoints

| Ruta | Permiso |
|---|---|
| `POST /api/v1/auth/login` `{ correo, password, empresaId? }` | — |
| `POST /api/v1/auth/refresh` `{ refreshToken }` (rota el refresh) | — |
| `POST /api/v1/auth/logout` `{ refreshToken }` | — |
| `POST /api/v1/auth/olvide` `{ correo }` (siempre 204; enlace de un uso, 30 min) · `POST /auth/restablecer` `{ token, password }` (cierra todas las sesiones) | — (10 cada 5 min por IP) |
| `/api/v1/servidores-correo` (CRUD; `password` solo de entrada) · `POST {id}/probar` (conecta y autentica) · `POST global/probar` (root) | `config.servidores_correo` |
| CRUD `/api/v1/organizaciones` | `config.organizaciones` |
| CRUD `/api/v1/empresas` | `config.empresas` |
| CRUD `/api/v1/sucursales` | `config.sucursales` |
| CRUD `/api/v1/usuarios` (con `rolId`: su perfil, igual en todas sus empresas) + `PUT {id}/password` · `POST /usuarios/alta` (usuario + rol + accesos + ajustes + contraseña, todo o nada) · `PUT /usuarios/{id}/accesos` (empresa/planta/predeterminado, reemplaza) | `config.usuarios` (+ `config.accesos.crear`/`.editar`) |
| `GET`/`PUT /api/v1/usuarios/{id}/permisos` `{ agregados, quitados }` → `{ agregados, quitados, delRol, efectivos }`. Efectivos = (rol ∪ agregados) menos lo que cubran los quitados (admiten comodín); la sesión ya trae los efectivos | `config.usuarios` |
| CRUD `/api/v1/roles`, `/api/v1/rol-permisos` · `GET /roles/resumen` (con `permisos[]` y `usuarios`) · `PUT /roles/{id}/permisos` `{ permisos }` (reemplaza todos) | `config.roles` |
| `GET /api/v1/permisos` (catálogo con nombres; empieza con `*`) | `config.roles.ver` |
| CRUD `/api/v1/usuario-accesos` | `config.accesos` |
| CRUD `/api/v1/secuencias` | `config.secuencias` |
| CRUD `/api/v1/actividades` + `GET registro/{tipo}/{id}` (programar, hecha y cancelada dejan un evento `actividad` en el hilo del registro) | `general.actividades` |
| CRUD `/api/v1/seguidores` | `general.seguidores` |
| `GET /api/v1/historial/{tipo}/{id}`, `POST …/notas` | `general.historial.ver/crear` |
| `POST /api/v1/archivos` (multipart), `GET {id}`, `GET registro/{tipo}/{id}`, `DELETE {id}` | `general.archivos` |
| `GET /api/v1/sesiones?usuarioId=`, `DELETE {id}` (revoca) | `config.sesiones` |
| CRUD `/api/v1/clientes`, `/cliente-contactos`, `/cliente-datos-fiscales` | `ventas.clientes` |
| CRUD `/api/v1/obras`: de un cliente o generales (`clienteId` null, de la organización). Lista con `?clienteId=`, `?sinCliente=true`, `?q=` (nombre, dirección, municipio). DELETE con cotizaciones o pedidos → 409 | `ventas.obras` |
| CRUD `/api/v1/prospectos` | `crm.prospectos` |
| CRUD `/api/v1/productos`, `/categorias-producto`, `/unidades-medida`, `/producto-equipos` | `ventas.productos` |
| `soluciones` del producto (solo concreto): `pavimento`, `losa`, `cimentacion`, `columnas`, `firmes`, `relleno`, `especial`. `GET /productos?solucion=losa`. El seed etiqueta por resistencia los concretos sin soluciones | `ventas.productos` |
| Partidas: `exposicion` normal\|humedad\|marina, `colocacion` directa\|bombeable (400 si no) | — |
| Aditivos: productos de la categoría `aditivo` con código `AJ-ADT-{CLAVE}` (400 si no). En la cotización, `partidas[].aditivos` lleva la clave (`fibra-sintetica`); cada una debe ser un aditivo activo de tus productos (400) | `ventas.productos` |
| CRUD `/api/v1/listas-precios`, `/lista-precios-sucursales`, `/reglas-precio` | `ventas.listas_precios` |
| CRUD `/api/v1/programas-descuento`, `/cupones`, `/saldos-lealtad` | `ventas.programas` |
| CRUD `/api/v1/equipos` | `flota.equipos` |
| CRUD `/api/v1/impuestos` | `config.impuestos` |
| `GET /api/v1/existencias` (solo lectura) | `inventario.existencias.ver` |
| `GET`/`POST /api/v1/movimientos-inventario` (suma la existencia) | `inventario.movimientos` |
| CRUD `/api/v1/remisiones` (folio vacío = el siguiente de la planta) | `operacion.remisiones` |
| `GET /api/v1/monedas` | — |
| `GET`/`PUT /api/v1/me` (nombre, apellidos, teléfono, puesto, fotoArchivoId) · `PUT /me/password` `{ actual, nueva }` (cierra las demás sesiones) | — |
| `GET`/`PUT /api/v1/me/preferencias` (objeto JSON libre, hasta 64 KB) | — |
| `GET /api/v1/me/sesiones` (vigentes, con `actual`) · `DELETE /me/sesiones/{id}` | — |
| `GET /api/v1/me/notificaciones?soloNoLeidas&skip&take` → `{ items, total, noLeidas }` · `PUT /me/notificaciones/{id}/leida` · `PUT /me/notificaciones/leidas` (las genera el back: cotización del portal, cotización confirmada, pedido cambia de estado o de estatus de planta, actividad asignada o vencida) | — |
| `GET /api/v1/usuarios/resumen` → `[{ id, nombre, activo }]` de la organización | — |
| `GET /api/v1/secuencias/siguiente?tipo=cotizacion&sucursalId=` → `{ folio }` (no lo consume) | — |
| Cotizaciones, ver abajo | `ventas.cotizaciones.*` |
| Pedidos, ver abajo | `ventas.pedidos.*` |

CRUD = `GET` (lista, `?skip=&take=` hasta 500), `GET {id}`, `POST`, `PUT {id}` (el registro completo), `DELETE {id}`.
Las listas filtran por igualdad con la query: `?clienteId=…&activo=true&estado=por_cobrar`; una clave repetida es
"cualquiera de" (`?sucursalId=a&sucursalId=b`).
`organizacionId` vacío al crear = la del usuario.

### Cotizaciones y pedidos

La API calcula todos los importes con las reglas del front (`formato.ts`), redondeando a centavos por línea:

- Partida = volumen × precio/m³ + traslado (km después de los incluidos × $/km, por m³) + sus líneas.
- Línea = cantidad × precio × días. Los productos con `minimoCobro` cobran al menos ese mínimo (bombeo: 10 m³).
- `pedidoMinimo` del producto: no se puede pedir menos (400 "El pedido mínimo de X es N unidad"). Se revisa el volumen de
  cada partida contra su concreto y cada línea contra su producto al crear/editar cotizaciones (ERP y portal, revisiones
  incluidas), al confirmar o aceptar en el portal y al crear/editar pedidos.
- `precioM3` vacío = tarifa: concreto (`CON-FC-200`) + ajuste por edad + cemento RS + aditivos.
- Con `trasladoDistanciaKm` y sin km incluidos o $/km, se usan los de la planta (`Sucursal.KmIncluidos`, `PrecioKm`).
- El descuento (`descuentoPct`) se resta antes del IVA; se guarda su importe en `descuento`.

| Ruta | Permiso |
|---|---|
| `GET /api/v1/cotizaciones` → `{ items, total }` (`?pagina=1&tamano=50`, `incluir=partidas`, `desde`/`hasta` ISO, `estado`, `clienteId`, `sucursalId`…) · `GET {id}` (con `partidas[].lineas[]`) | `.ver` |
| `POST /api/v1/cotizaciones` (`revisionDeId` → `{serie}-R1`; `baseId` → nueva basada en otra). Entrega: `obraId` **o** lugar (`entregaDireccion`, `entregaMunicipio`, `entregaReferencias`, `entregaLat`, `entregaLng`), no los dos; puede faltar en borrador, no al enviar ni confirmar. Lo mismo en `/pedidos` (ahí es obligatorio) | `.crear` |
| `PUT {id}` (solo `recibida`/`borrador`; partidas y líneas con `id` se editan, sin `id` se agregan, las que faltan se quitan) · `POST {id}/ocultar` | `.editar` |
| `POST {id}/enviar` · `POST {id}/cancelar` | `.enviar` · `.cancelar` |
| `POST {id}/confirmar` → un pedido por partida (pide cliente, obra o lugar de entrega, y fecha de entrega; el lugar pasa al pedido) | `.confirmar` |
| Pedido especial: partida con `especial: true` sin tarifa se guarda sin producto y con `precioM3` null (cuenta 0). Enviar/confirmar/aceptar piden precio (400). En el pedido, su línea de concreto usa el producto `CON-ESPECIAL` con la especificación capturada | — |
| `GET /api/v1/pedidos` → `{ items, total }` (igual que cotizaciones, con `incluir=lineas`; fechas sobre la entrega) · `GET {id}` (con `lineas[]`) | `ventas.pedidos.ver` |
| `POST /api/v1/pedidos` (orden directa) · `PUT {id}` (solo programado; reenvía a planta si cambia entrega o volumen) | `.crear` · `.editar` |
| `POST {id}/cobro` `{ valor }` · `POST {id}/metodo-pago` `{ valor }` · `POST {id}/estado` `{ valor }` | `.cobrar` · `.editar` · `.estado` |
| `POST {id}/planta` `{ accion, fecha?, nota? }`: `enviar`, `confirmar`, `actualizacion`, `rechazar`, `aceptar_actualizacion` | `.planta` |
| `POST {id}/cancelar` | `.cancelar` |

Folios por planta (tabla `Secuencia`): `EPI-PRES-ESC-26001`, `PED-ESC-26-001`, `REM-ESC-26-001`.
