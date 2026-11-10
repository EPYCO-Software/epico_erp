# EPICO (monorepo)

| Carpeta | Qué es | Guía |
|---|---|---|
| `Frontend/` | Workspace Angular: apps `erp` y `portal`, librería `ui` | [Frontend/CLAUDE.md](Frontend/CLAUDE.md) |
| `Backend/` | API (por definir) | — |

- Los comandos de npm/ng se corren dentro de `Frontend/` (`cd Frontend && npm start`).
- En la raíz quedan solo lo compartido: `.github/workflows/` (CI), `docker-compose.yml`, `.vscode/` y `.editorconfig`.
- CI/CD: `frontend-erp.yml` y `frontend-portal.yml` (cada uno con sus `paths`) llaman a `frontend-app.yml`, que
  construye la imagen de esa app y la despliega en el VPS; `backend.yml` hace lo mismo con `Backend/**`.
  `develop` → imagen `:develop` → servicio `*-dev`; `main` → `:latest` → servicio de prod.
- Solo dependencias con licencia libre, en ambas carpetas.
