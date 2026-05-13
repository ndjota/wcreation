# Guía del desarrollador

## Requisitos

- **Node.js 22+**, **pnpm 9+**, **Docker** (para Timescale, Redis, EMQX local).
- **OpenSSL** para PKI de desarrollo.

## Comandos útiles

```bash
pnpm install
bash scripts/setup.sh
bash scripts/seed-dev.sh
pnpm dev:detach && pnpm dev:api && pnpm dev:bridge
pnpm test
pnpm lint
```

## Estándares

- **TypeScript estricto** en todo el monorepo.
- **Commits convencionales**: `feat:`, `fix:`, `docs:`, `refactor:`, `deploy:`, `ops:`.
- **ESLint** flat config + **Prettier** (raíz del repo).
- **Tests**: Vitest (`pnpm test`). El test de RLS requiere `SUPABASE_DB_URL` para ejecutarse (en CI con secreto).

## Estructura

| Ruta | Rol |
|------|-----|
| `apps/api` | Fastify, REST, WebSocket, métricas `/metrics` |
| `apps/pwa` | React, Vite, PWA |
| `apps/mqtt-bridge` | Ingest MQTT → Timescale + Redis + sync |
| `apps/telegram-bot` | Bot Telegraf |
| `packages/shared` | Tipos y convenciones MQTT |
| `packages/db-*` | Migraciones SQL |
| `infra/` | Compose dev, EMQX, Dokploy de referencia |

## Docker de producción

Los **Dockerfiles** asumen **contexto en la raíz del monorepo** (como indica Dokploy con “build path” apuntando a la app pero contexto del repo completo). Ejemplo build API:

```bash
docker build -f apps/api/Dockerfile -t wcreation-api:1.0.0 .
```

## Variables sensibles

Nunca commitear `.env`. Usar `.env.example` como plantilla y Dokploy para producción.
