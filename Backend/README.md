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
`PUT /api/v1/me/password`) con el rol Root y acceso a las dos empresas, y tres roles del sistema:

| Rol | Permisos |
|---|---|
| Root | `*`: todo, sin filtro por empresa |
| Administrador | `config.*`, `general.*`, `ventas.*`, `crm.*`, `inventario.*`, `flota.*`, `operacion.*` |
| Ventas | `ventas.clientes.*`, `ventas.cotizaciones.*`, `ventas.pedidos.*`, `crm.*`, `general.*` y ver productos, listas de precios, programas, existencias, equipos y remisiones |

Los permisos de un rol se ponen solo al crearlo: lo que cambies desde la pantalla de roles no se pisa en el siguiente deploy.
Un permiso puede ser exacto (`ventas.cotizaciones.enviar`) o un comodín de módulo o recurso (`ventas.*`, `ventas.clientes.*`).

## Datos de demo (solo desarrollo)

```bash
dotnet run --project src/EPICO.Api -- --migrate --demo   # o Seed__Demo=true
```

Crea la empresa **Concretos Demo S.A. de C.V.** (plantas DMA Planta Norte, Mérida, y DMB Planta Sur, Campeche, con
traslado distinto) y le da acceso a `admin@epyco.cloud`. Trae un registro de cada opción: cotizaciones por estado y origen,
pedidos por estado, cobro, método de pago y estatus de planta, un viaje en cada estado, prospectos por etapa, actividades,
notas, una lista de precios con los tres tipos de regla, un programa por tipo y equipos de cada tipo.
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
| `cliente@demo.epyco.cloud` | Portal, contacto de Constructora Peninsular Demo (obras Torre Altabrisa con GPS y Bodega Umán) |

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
| `GET`/`PUT /portal/perfil` | Usuario + cliente que representa (el cliente es de solo lectura) |
| `/portal/datos-fiscales`, `/portal/obras`, `/portal/disenos` (CRUD) | `clienteId` lo pone el back. Obra con pedido en curso no se edita (409) |
| `POST /portal/archivos` · `GET /portal/archivos/{id}` · `GET /portal/archivos/registro/{tipo}/{id}` · `DELETE` | Solo de registros suyos: Cliente, ClienteDatoFiscal, Obra, Usuario |
| `GET /portal/catalogo` | Productos, categorías, unidades, su lista de precios con reglas, plantas e IVA |
| `GET /portal/cotizaciones` · `GET /{id}` · `POST` · `POST /{id}/aceptar` | Sin borradores ni ocultas. El POST entra "recibida" con precios de tarifa (ignora los del cliente) |
| `GET /portal/pedidos` · `GET /{id}` · `GET /portal/remisiones` | Con obra, planta, cobro y viajes |

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
