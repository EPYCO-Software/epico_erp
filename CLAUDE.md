# EPICO (monorepo)

| Carpeta | Qué es | Guía |
|---|---|---|
| `Frontend/` | Workspace Angular: apps `erp` y `portal`, librería `ui` | [Frontend/CLAUDE.md](Frontend/CLAUDE.md) |
| `Backend/` | API (por definir) | — |

- Los comandos de npm/ng se corren dentro de `Frontend/` (`cd Frontend && npm start`).
- En la raíz quedan solo lo compartido: `.github/workflows/` (CI), `docker-compose.yml`, `.vscode/` y `.editorconfig`.
- CI: `.github/workflows/docker.yml` construye las imágenes del frontend con contexto `./Frontend` y solo se
  dispara con cambios en `Frontend/**`. Cuando exista el backend, darle su propio workflow con `paths: Backend/**`.
- Solo dependencias con licencia libre, en ambas carpetas.
