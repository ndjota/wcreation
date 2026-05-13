# Changelog

Todos los cambios notables de WCreation se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y el versionado [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.0] — 2026-05-13

### Agregado

- Despliegue listo para **Dokploy**: Dockerfiles multi-stage (`apps/api`, `apps/pwa`, `apps/mqtt-bridge`, `apps/telegram-bot`).
- Compose de referencia para **EMQX** (TCP TLS passthrough en Traefik v3, dashboard detrás de basic auth).
- Compose **TimescaleDB + Redis** con tuning conservador para ~2 GB RAM.
- Compose opcional **Uptime Kuma** para monitoreo HTTP/TCP/Postgres.
- Script **`scripts/backup-production.sh`**: `pg_dump`, snapshot Traefik dinámico, certs cifrados, subida opcional `rclone` (R2/B2 + lifecycle en bucket).
- Script **`scripts/fix-traefik-ips-wcreation.sh`**: fragmento comentado de `trustedIPs` para Traefik (patrón NDJota).
- **API**: CORS estricto en producción, límite global 100 req/min por IP, 1000 req/min por usuario autenticado (Redis), `/metrics` con **prom-client**, HSTS vía Helmet, redacción Pino en producción.
- **PWA**: nginx con gzip/brotli, cache agresivo en assets, sin cache en `index.html`, CSP y HSTS en cabeceras estáticas.
- **mqtt-bridge / telegram-bot**: servidor HTTP **`/health`** en `HEALTH_LISTEN_PORT` (9090 en Dockerfiles).
- Test **`tests/supabase-rls.test.ts`**: verificación de `relrowsecurity` en todas las tablas `wcreation` (requiere `SUPABASE_DB_URL`).
- Documentación operativa y de desarrollo en **`docs/`**.

### Cambido

- Versión de producto unificada en **1.0.0** para API y PWA.

### Seguridad

- Rate limit agresivo en rutas públicas QR (30/min por IP donde aplica).
- Sin CSP JSON en API en producción (CSP estricto delegado a la PWA en nginx).

[1.0.0]: https://github.com/ndjota/wcreation/releases/tag/v1.0.0
