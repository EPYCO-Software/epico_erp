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
{ "Jwt": { "Key": "<32+ caracteres>" }, "Seed": { "RootPassword": "<contraseña del root>" } }
```

## Configuración (variables de entorno en el VPS)

| Variable | Para qué |
|---|---|
| `ConnectionStrings__Default` | Cadena de Postgres |
| `Jwt__Key` | Llave para firmar los JWT, 32+ caracteres. Sin ella la API no arranca |
| `Seed__RootPassword` | Contraseña del usuario root la primera vez que corre `--migrate`. Si ya existe, no se cambia |
| `Seed__RootCorreo` | Correo del root (por defecto el de `appsettings.json`) |
| `Archivos__Ruta` | Carpeta de los archivos subidos; en Docker, móntala como volumen |
| `Cors__AllowedOrigins__0` | Origen del front si no va por el mismo dominio |

Nueva migración: `dotnet ef migrations add <Nombre> -p src/EPICO.Infrastructure -s src/EPICO.Api -o Persistence/Migrations`.

## Documentación (OpenAPI)

En Development: UI en `/scalar` (botón *Authenticate* → pega el `token` del login) y el JSON en `/openapi/v1.json`.
Cada endpoint trae su permiso, sus filtros y sus respuestas 401/403; los textos salen de los comentarios `///` del código.
Copia sin servidor: [docs/openapi.json](docs/openapi.json) (se importa en Postman, Insomnia o editor.swagger.io).
Si cambian los endpoints, regénerala con la API corriendo:

```bash
curl -s http://localhost:5157/openapi/v1.json | python -m json.tool --no-ensure-ascii > docs/openapi.json
```

## Reglas que aplica la API

- Todo exige `Authorization: Bearer <token>` salvo `/api/v1/auth/*` y `/health`.
- Permisos por endpoint: `{recurso}.ver|crear|editar|eliminar` según el verbo (GET/POST/PUT/DELETE), de `RolPermiso`. `*` = todos.
- Filtros globales: borrado lógico, empresas del usuario (`UsuarioAcceso`) y su organización. Root no se filtra.
- Historial: al guardar, cada campo `[Rastreado]` que cambia queda en `Evento` + `EventoCambio`. Solo se agrega.
- Errores en formato ProblemDetails (`detail` trae el mensaje): 400 validación o referencia inexistente, 401, 403 sin permiso o empresa ajena, 404, 409 duplicado, 429 usuario bloqueado (5 intentos, 15 min).
- JSON en camelCase; los enums como en el dbml (`interno`, `fecha_hora`…).

## Endpoints

| Ruta | Permiso |
|---|---|
| `POST /api/v1/auth/login` `{ correo, password, empresaId? }` | — |
| `POST /api/v1/auth/refresh` `{ refreshToken }` (rota el refresh) | — |
| `POST /api/v1/auth/logout` `{ refreshToken }` | — |
| CRUD `/api/v1/organizaciones` | `config.organizaciones` |
| CRUD `/api/v1/empresas` | `config.empresas` |
| CRUD `/api/v1/sucursales` | `config.sucursales` |
| CRUD `/api/v1/usuarios` + `PUT {id}/password` | `config.usuarios` |
| CRUD `/api/v1/roles`, `/api/v1/rol-permisos` | `config.roles` |
| CRUD `/api/v1/usuario-accesos` | `config.accesos` |
| CRUD `/api/v1/secuencias` | `config.secuencias` |
| CRUD `/api/v1/actividades` + `GET registro/{tipo}/{id}` | `general.actividades` |
| CRUD `/api/v1/seguidores` | `general.seguidores` |
| `GET /api/v1/historial/{tipo}/{id}`, `POST …/notas` | `general.historial.ver/crear` |
| `POST /api/v1/archivos` (multipart), `GET {id}`, `GET registro/{tipo}/{id}`, `DELETE {id}` | `general.archivos` |
| `GET /api/v1/sesiones?usuarioId=`, `DELETE {id}` (revoca) | `config.sesiones` |
| CRUD `/api/v1/clientes`, `/cliente-contactos`, `/cliente-datos-fiscales`, `/obras` | `ventas.clientes` |
| CRUD `/api/v1/prospectos` | `crm.prospectos` |
| CRUD `/api/v1/productos`, `/categorias-producto`, `/unidades-medida`, `/producto-equipos` | `ventas.productos` |
| CRUD `/api/v1/listas-precios`, `/lista-precios-sucursales`, `/reglas-precio` | `ventas.listas_precios` |
| CRUD `/api/v1/programas-descuento`, `/cupones`, `/saldos-lealtad` | `ventas.programas` |
| CRUD `/api/v1/equipos` | `flota.equipos` |
| CRUD `/api/v1/impuestos` | `config.impuestos` |
| `GET /api/v1/existencias` (solo lectura) | `inventario.existencias.ver` |
| `GET`/`POST /api/v1/movimientos-inventario` (suma la existencia) | `inventario.movimientos` |
| CRUD `/api/v1/remisiones` (folio vacío = el siguiente de la planta) | `operacion.remisiones` |
| `GET /api/v1/monedas` | — |
| Cotizaciones, ver abajo | `ventas.cotizaciones.*` |
| Pedidos, ver abajo | `ventas.pedidos.*` |

CRUD = `GET` (lista, `?skip=&take=` hasta 500), `GET {id}`, `POST`, `PUT {id}` (el registro completo), `DELETE {id}`.
Las listas filtran por igualdad con la query: `?clienteId=…&activo=true&estado=por_cobrar`.
`organizacionId` vacío al crear = la del usuario.

### Cotizaciones y pedidos

La API calcula todos los importes con las reglas del front (`formato.ts`), redondeando a centavos por línea:

- Partida = volumen × precio/m³ + traslado (km después de los incluidos × $/km, por m³) + sus líneas.
- Línea = cantidad × precio × días. Los productos con `minimoCobro` cobran al menos ese mínimo (bombeo: 10 m³).
- `precioM3` vacío = tarifa: concreto (`CON-FC-200`) + ajuste por edad + cemento RS + aditivos.
- El descuento (`descuentoPct`) se resta antes del IVA; se guarda su importe en `descuento`.

| Ruta | Permiso |
|---|---|
| `GET /api/v1/cotizaciones` (encabezados; `?estado=&clienteId=&sucursalId=&serie=`) · `GET {id}` (con `partidas[].lineas[]`) | `.ver` |
| `POST /api/v1/cotizaciones` (`revisionDeId` → `{serie}-R1`; `baseId` → nueva basada en otra) | `.crear` |
| `PUT {id}` (solo `recibida`/`borrador`; partidas y líneas con `id` se editan, sin `id` se agregan, las que faltan se quitan) · `POST {id}/ocultar` | `.editar` |
| `POST {id}/enviar` · `POST {id}/cancelar` | `.enviar` · `.cancelar` |
| `POST {id}/confirmar` → un pedido por partida (pide cliente, obra y entrega) | `.confirmar` |
| `GET /api/v1/pedidos` (`?cobro=&estado=&sucursalId=&cotizacionId=`) · `GET {id}` (con `lineas[]`) | `ventas.pedidos.ver` |
| `POST /api/v1/pedidos` (orden directa) · `PUT {id}` (solo programado; reenvía a planta si cambia entrega o volumen) | `.crear` · `.editar` |
| `POST {id}/cobro` `{ valor }` · `POST {id}/metodo-pago` `{ valor }` · `POST {id}/estado` `{ valor }` | `.cobrar` · `.editar` · `.estado` |
| `POST {id}/planta` `{ accion, fecha?, nota? }`: `enviar`, `confirmar`, `actualizacion`, `rechazar`, `aceptar_actualizacion` | `.planta` |
| `POST {id}/cancelar` | `.cancelar` |

Folios por planta (tabla `Secuencia`): `EPI-PRES-ESC-26001`, `PED-ESC-26-001`, `REM-ESC-26-001`.
