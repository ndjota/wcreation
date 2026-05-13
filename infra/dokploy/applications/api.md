# Dokploy — Application `apps/api`

- **Tipo**: Application → Docker.
- **Repositorio**: `ndjota/wcreation`, rama `main`.
- **Build context**: raíz del monorepo (donde está `pnpm-lock.yaml`).
- **Dockerfile**: `apps/api/Dockerfile`.
- **Puerto interno del contenedor**: `3001`.
- **Dominio**: `api.wcreation.ndjota.io` → HTTPS (Traefik → contenedor 3001).
- **Healthcheck HTTP**: `GET /health` (Dockerfile ya incluye probe).
- **Recursos**: 512 MB RAM, 0.5 CPU (ajustar según carga).

## Variables (producción)

Copiá desde `.env.example` del repo; como mínimo: Supabase service, `VPS_DATABASE_URL`, `REDIS_URL`, `EVENT_SIGNING_KEY`, URLs públicas, `CORS_ORIGINS`, SMTP/VAPID/Telegram si usás notificaciones.

## Notas

- Métricas Prometheus: `GET /metrics` (restringir en Traefik si no debe ser público).
- WebSocket: `wss://api.wcreation.ndjota.io/ws/realtime` (misma host que API).
