# EPICO ERP

- `Frontend/`: Angular (ERP y portal de clientes). Ver [Frontend/README.md](Frontend/README.md).
- `Backend/`: API.

Probar las apps como en producción: `docker compose up --build` (ERP en :8080, portal en :8081).


# FRONTEND


# BACKEND

El backend es una API de ASP.NET Core 10 que utiliza Entity Framework Core y
PostgreSQL. Los siguientes comandos deben ejecutarse desde la raíz del
repositorio.

## Requisitos

- .NET SDK 10.
- Docker Desktop en ejecución.
- La herramienta de Entity Framework Core:

```powershell
dotnet tool install --global dotnet-ef --version 10.0.14
dotnet ef --version
```

Si `dotnet-ef` ya está instalado, puede actualizarse con:

```powershell
dotnet tool update --global dotnet-ef --version 10.0.14
```

## Inicializar la base de datos

El servicio `database` de `docker-compose.yml` crea un contenedor de PostgreSQL
en `localhost:5432` y conserva la información en el volumen `pgdata`.

```powershell
# Iniciar PostgreSQL en segundo plano
docker compose up -d database

# Comprobar que el contenedor está activo
docker compose ps database

# Crear/actualizar el esquema aplicando todas las migraciones pendientes
dotnet ef database update --project Backend/src/EPICO.Infrastructure --startup-project Backend/src/EPICO.Api
```

La conexión local utilizada por la API está configurada en
`Backend/src/EPICO.Api/appsettings.json`.

## Crear y aplicar migraciones

Después de modificar una entidad o la configuración del `AppDbContext`, crear
una migración con un nombre descriptivo:

```powershell
dotnet ef migrations add NombreDeLaMigracion --project Backend/src/EPICO.Infrastructure --startup-project Backend/src/EPICO.Api --output-dir Persistence/Migrations
```

Revisar las migraciones disponibles y aplicarlas:

```powershell
dotnet ef migrations list --project Backend/src/EPICO.Infrastructure --startup-project Backend/src/EPICO.Api
dotnet ef database update --project Backend/src/EPICO.Infrastructure --startup-project Backend/src/EPICO.Api
```

Para retirar únicamente la última migración cuando todavía no se ha aplicado a
la base de datos:

```powershell
dotnet ef migrations remove --project Backend/src/EPICO.Infrastructure --startup-project Backend/src/EPICO.Api
```

## Iniciar el backend

Primero verifica que PostgreSQL esté activo y que las migraciones estén
aplicadas. Después ejecuta:

```powershell
dotnet restore Backend/EPICO_ERP.slnx
dotnet run --project Backend/src/EPICO.Api --launch-profile http
```

Servicios disponibles durante el desarrollo:

- API: `http://localhost:5157`
- Clientes: `http://localhost:5157/api/v1/crm/customers`
- Documentación Scalar: `http://localhost:5157/scalar/v1`
- OpenAPI: `http://localhost:5157/openapi/v1.json`

Para detener PostgreSQL sin eliminar sus datos:

```powershell
docker compose stop database
```

## Desarrollo con Docker

`compose.backend.dev.yml` levanta PostgreSQL y el backend con recarga automática.
Al arrancar aplica las migraciones pendientes antes de iniciar `dotnet watch`:

```powershell
docker compose -f compose.backend.dev.yml up --build
```

La API queda en `http://localhost:5157`. Los cambios realizados dentro de
`Backend/` se reflejan en el contenedor sin reconstruir la imagen. Para detener
el entorno y conservar la base de datos:

```powershell
docker compose -f compose.backend.dev.yml down
```

## Imagen Docker de producción

`Backend/Dockerfile` utiliza una compilación multi-stage: compila con el SDK y
publica únicamente el runtime y la aplicación en la imagen final. También se
ejecuta como usuario sin privilegios e incluye un health check en `/health`.

Construir y probar la imagen localmente:

```powershell
docker build -f Backend/Dockerfile -t epico-erp-backend:local .
docker run --rm -p 5157:8080 `
  -e "ConnectionStrings__Default=Host=host.docker.internal;Port=5432;Database=epico_erp;Username=postgres;Password=postgres" `
  -e "Cors__AllowedOrigins__0=http://localhost:4200" `
  epico-erp-backend:local
```

## Publicación automática de la imagen

El workflow `.github/workflows/backend.yml` realiza lo siguiente:

1. Compila el backend en cada pull request que modifica `Backend/`.
2. Construye y publica la imagen en
   `ghcr.io/epyco-software/epico-erp-backend` al hacer push a `main`.
3. Genera las etiquetas `latest`, `sha-<commit>` y etiquetas de versión para
   tags Git como `v1.2.0`.
4. Opcionalmente despliega en el VPS después de publicar `latest`.

GHCR utiliza automáticamente el `GITHUB_TOKEN` del workflow; no hace falta
guardar una contraseña del registry en GitHub Actions.

## Ejemplo de Docker Compose para el VPS

El archivo listo para producción es `compose.backend.prod.yml`. PostgreSQL no
publica ningún puerto hacia Internet y el backend escucha por defecto solamente
en `127.0.0.1:5157`, pensado para colocarlo detrás de Nginx, Caddy o Traefik.

La estructura equivalente que debe existir en el VPS es:

```yaml
services:
  database:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]

  migrate:
    image: ${BACKEND_IMAGE}:${BACKEND_TAG}
    entrypoint: ["dotnet", "EPICO.Api.dll", "--migrate"]
    environment: &backend-environment
      ConnectionStrings__Default: Host=database;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}
      Cors__AllowedOrigins__0: ${FRONTEND_ORIGIN}
    depends_on:
      database:
        condition: service_healthy
    profiles: [tools]

  backend:
    image: ${BACKEND_IMAGE}:${BACKEND_TAG}
    environment: *backend-environment
    ports:
      - "127.0.0.1:${BACKEND_PORT}:8080"
    depends_on:
      database:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_prod_data:
```

Para preparar el VPS por primera vez:

```bash
sudo mkdir -p /opt/epico
sudo chown "$USER":"$USER" /opt/epico
cd /opt/epico

# Copiar aquí compose.backend.prod.yml y crear .env a partir del ejemplo.
cp backend.env.example .env
nano .env
```

El contenido base del `.env` se encuentra en `deploy/backend.env.example`.
Debe cambiarse como mínimo `POSTGRES_PASSWORD` y `FRONTEND_ORIGIN`. El archivo
`.env` real nunca debe subirse al repositorio.

Si el paquete de GHCR es privado, iniciar sesión una sola vez en el VPS con un
token que tenga permiso `read:packages`:

```bash
echo "TU_GITHUB_TOKEN" | docker login ghcr.io -u TU_USUARIO_GITHUB --password-stdin
```

Despliegue manual o actualización:

```bash
cd /opt/epico
docker compose --env-file .env -f compose.backend.prod.yml pull backend migrate
docker compose --env-file .env -f compose.backend.prod.yml up -d database
docker compose --env-file .env -f compose.backend.prod.yml run --rm migrate
docker compose --env-file .env -f compose.backend.prod.yml up -d --remove-orphans backend
```

La migración se ejecuta como un contenedor temporal y debe finalizar
correctamente antes de actualizar la API.

## Despliegue automático al VPS

Push a `develop` despliega en el Environment `development` (imagen `:develop`);
push a `main` despliega en `production` (imagen `:latest`). Ambos van al mismo
VPS: el job entra por SSH, hace `cd $VPS_PATH`, `docker compose pull $VPS_SERVICE`,
corre las migraciones (`run --rm $VPS_SERVICE --migrate`) y reinicia solo ese servicio.

Configurar en GitHub:

- Variable de repositorio `ENABLE_VPS_DEPLOY` = `true`.
- Secrets de repositorio: `VPS_HOST`, `VPS_USER` (con acceso a Docker),
  `VPS_SSH_KEY` (clave privada de deploy) y opcional `VPS_PORT` si SSH no usa el 22.
- Variables de repositorio: `VPS_SERVICE_DEV` y `VPS_SERVICE_PROD` (nombre de
  cada servicio en el compose) y `VPS_PATH` (ruta absoluta de la carpeta
  con `compose.yml` y `.env`; puede ser la misma para ambos).

La huella del servidor no se verifica (`StrictHostKeyChecking accept-new`).
