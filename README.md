# WCreation

> **Estado: production-ready — v1.0.0.** Cambios: [CHANGELOG.md](./CHANGELOG.md) · Notas de release: [RELEASE_NOTES_v1.0.0.md](./RELEASE_NOTES_v1.0.0.md) · Documentación operativa: [docs/README.md](./docs/README.md)

Sistema profesional de **control y certificación de cadena de frío** para farmacias, hospitales y supermercados. Los dispositivos ESP32 publican telemetría por **MQTT sobre TLS mutuo (X.509)**; el backend persiste series temporales en **TimescaleDB** y datos operacionales en **Supabase**.

![Vista previa del dashboard](docs/assets/dashboard-preview.svg)

## Stack

| Componente        | Rol |
|-------------------|-----|
| pnpm + Node 22    | Monorepo TypeScript estricto |
| Docker Compose    | TimescaleDB (PG16), Redis, EMQX 5.8, Mailhog |
| OpenSSL           | CA propia, certificados de broker y dispositivos |
| Migraciones SQL   | `packages/db-vps` (Timescale) y `packages/db-supabase` (Supabase Cloud) |
| **Etapa 5**       | **Dokploy**, Dockerfiles, compose EMQX/Timescale/Redis, backups, Uptime Kuma, `/metrics`, hardening |
| **Etapa 2–4**     | **Fastify** API, **mqtt-bridge**, **PWA** React, Telegram, notificaciones, **Bruno** en `infra/bruno/wcreation` |

## Supabase Cloud (creación y credenciales)

1. En [supabase.com](https://supabase.com) creá una organización (si no tenés) y **New project**.
2. **Región recomendada desde Argentina:** *South America (São Paulo)* — baja latencia y misma zona que muchos proveedores cloud.
3. Definí una **contraseña fuerte** para la base Postgres del proyecto; guardala en un gestor de contraseñas.
4. En **Authentication → Providers**, dejá **Email** habilitado (el seed y el E2E usan `grant_type=password` contra GoTrue).
5. Tras crear el proyecto, en **Settings → API** copiá:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (solo backend y scripts, nunca en el PWA).
6. En **Settings → General → Reference ID** copiá el identificador del proyecto → `SUPABASE_PROJECT_REF` (para la CLI).
7. Instalá la [Supabase CLI](https://supabase.com/docs/guides/cli) y ejecutá `bash scripts/supabase-apply-migrations.sh` (vincula con `SUPABASE_PROJECT_REF` si hace falta y hace `db push`). Requiere `supabase login` o `SUPABASE_ACCESS_TOKEN`.
8. Cargá datos demo: `bash scripts/supabase-seed.sh` (emails y contraseña vía variables del `.env`). **Si aparece `PGRST106` / schema `wcreation` inválido:** en el dashboard del proyecto → **Settings → Data API** agregá **`wcreation`** a **Exposed schemas** ([doc](https://supabase.com/docs/guides/api/using-custom-schemas)) y volvé a ejecutar el seed. Flujo guiado: `pnpm supabase:option-b` (equiv. `bash scripts/option-b-setup.sh`).

**Nota de seguridad:** la validación de JWT en el API usa **JWKS remoto** (`jose`), no una clave pública estática, para soportar la rotación de claves de Supabase.

## Etapa 2 — API, bridge y pruebas

Con `.env` completo (incluido `EVENT_SIGNING_KEY` de ≥32 caracteres, igual en API y bridge):

```bash
pnpm dev:detach          # Timescale + Redis + EMQX + Mailhog
pnpm dev:api             # API :3001 + /docs — equiv. `pnpm --filter @wcreation/api dev`
pnpm dev:bridge          # Ingest MQTT — equiv. `pnpm --filter @wcreation/mqtt-bridge dev`
```

Simulador de dispositivo (cert `SN-DEV-001` generado por `seed-dev.sh`):

```bash
pnpm --filter @wcreation/mqtt-bridge simulate-device SN-DEV-001
```

Prueba end-to-end (levanta compose si hace falta, API, bridge, simulador 30s, valida lecturas/eventos/verify):

```bash
bash scripts/test-e2e.sh
```

**WebSocket en tiempo real** (ejemplo con `wscat`):

```bash
npx wscat -c "ws://127.0.0.1:3001/ws/realtime?access_token=TU_JWT_SUPABASE"
# Luego enviar: {"action":"subscribe","device_ids":["a1111111-1111-1111-1111-111111111111"]}
```

Colección **Bruno**: abrí la carpeta `infra/bruno/wcreation` en Bruno y configurá el environment `local` (`accessToken` = JWT de Supabase).

## Quickstart

Requisitos: **Node 22+**, **pnpm 9+**, **Docker Desktop**, **OpenSSL**, **psql** (cliente Postgres).

```bash
cp .env.example .env   # opcional: ajustá puertos si chocan con otros servicios locales
pnpm install
export WCREATION_CA_PASSPHRASE='tu-passphrase-8+'   # recomendado en CI/sin TTY; si no, pki-init la pide por consola
bash scripts/setup.sh
bash scripts/seed-dev.sh
bash scripts/healthcheck.sh
```

Levantar el stack en primer plano (logs de contenedores):

```bash
pnpm dev
```

En otra terminal podés correr `bash scripts/healthcheck.sh` mientras `pnpm dev` está activo.

Servicios expuestos:

| Servicio | URL / host |
|----------|------------|
| EMQX Dashboard | http://localhost:18083 (`admin` / `public`) |
| Mailhog | http://localhost:8025 |
| TimescaleDB | `localhost:5433` → contenedor `:5432` (usuario `postgres`, base `wcreation`, password `wcreation_dev`) |
| Redis | `localhost:6379` → contenedor `:6379` |

Los puertos por defecto siguen la Etapa 1 (`5433` / `6379`). Si chocan con otros servicios en tu Mac, definí `WCREATION_PG_PORT` y `WCREATION_REDIS_PORT` en `.env`.

Ver tablas del esquema Timescale en Postgres:

```bash
psql "postgres://postgres:wcreation_dev@127.0.0.1:5433/wcreation" -c "\dt wcreation.*"
```

Las migraciones de **Supabase** viven en `packages/db-supabase/migrations/` y se aplican al proyecto remoto con `bash scripts/supabase-apply-migrations.sh`.

## Estructura del monorepo

```
apps/api              # API Fastify 5: REST, WebSocket, Swagger /docs
apps/pwa              # PWA React + Vite + Tailwind (nginx en prod)
apps/mqtt-bridge      # Ingest MQTT (TLS mutuo) → Timescale + Redis + sync Supabase
apps/telegram-bot     # Bot Telegraf (alertas y comandos)
packages/shared       # Tipos, esquemas JSON y convenciones MQTT (`@wcreation/shared`)
packages/db-supabase  # SQL Supabase (schema `wcreation`, RLS)
packages/db-vps       # SQL Timescale en VPS
packages/pki          # Documentación de PKI
infra/                # docker-compose.dev.yml, EMQX, Dokploy (compose + apps)
scripts/              # setup, seed, healthcheck, PKI, backup producción, fix-traefik-ips
```

## Arquitectura (ASCII)

```
┌─────────────┐   mTLS MQTT    ┌──────────┐    SQL    ┌─────────────────────┐
│  ESP32 +    │ ─────────────► │  EMQX    │ ────────► │ Ingest worker       │
│  sensores   │   8883/TLS     │  broker  │           │ apps/mqtt-bridge    │
└─────────────┘                └──────────┘           └──────────┬──────────┘
                                                               │
                     ┌─────────────────────────────────────────┼────────────────────┐
                     │                                         ▼                    │
                     │                              ┌─────────────────────┐         │
                     │                              │ TimescaleDB (VPS)   │         │
                     │                              │ readings / events │         │
                     │                              └─────────────────────┘         │
                     │                                                            │
                     │   JWT + RLS                                                │
                     │   ┌──────────────┐         ┌─────────────────┐             │
                     └──►│ Supabase     │◄───────►│ apps/api        │─────────────┘
                         │ operacional  │  REST   │ + PWA (Etapa 4) │
                         └──────────────┘         └─────────────────┘
```

## Agregar un dispositivo nuevo

1. Asignar `tenant_id` y `device_id` (UUID) en Supabase cuando exista la instancia (Etapa 2).
2. Emitir certificado con el **número de serie** como CN del certificado:

   ```bash
   bash scripts/pki-new-device.sh SN-FARM-042
   ```

3. Registrar el fingerprint SHA-256 impreso por el script en la tabla operacional de certificados (Supabase / API).
4. Publicar solo bajo los tópicos permitidos por EMQX, por ejemplo:

   `wcreation/<tenant_uuid>/SN-FARM-042/telemetry`

## Despliegue a producción (Dokploy + Traefik v3)

Dominios públicos: **wcreation.ndjota.io** (PWA), **api.wcreation.ndjota.io** (API), **mqtt.wcreation.ndjota.io:8883** (MQTT TLS, passthrough TCP en Traefik), **mqtt-admin.wcreation.ndjota.io** (dashboard EMQX detrás de basic auth).

1. **Infra y checklist completo**: [infra/dokploy/VPS-DEPLOY.md](./infra/dokploy/VPS-DEPLOY.md) e [infra/dokploy/README.md](./infra/dokploy/README.md) (compose Timescale+Redis, EMQX, opcional Uptime Kuma).
2. **Aplicaciones**: Dockerfiles en `apps/*/Dockerfile`; **build context = raíz del repo**; variables desde `.env.example` solo en Dokploy.
3. **DNS**: registros A a la IP del VPS (Hostinger).
4. **PKI**: cert de broker con SAN `mqtt.wcreation.ndjota.io` firmado por la CA de producto (no Let’s Encrypt en dispositivos); renovación típica cada **24 meses** — [docs/device-provisioning.md](./docs/device-provisioning.md).
5. **Backups**: `scripts/backup-production.sh` + cron; destino recomendado **Cloudflare R2** con lifecycle (7d / 4w / 12m).
6. **Monitoreo**: Uptime Kuma (HTTP PWA, `/health`, TCP :8883, Postgres); alertas a Telegram personal si cae > 2 min; métricas `GET /metrics` en el API (Prometheus).
7. **Seguridad**: [docs/operator-runbook.md](./docs/operator-runbook.md).

Verificación sugerida: login superadmin, tenant demo, simulador MQTT producción, dashboard en vivo, QR público, notificaciones, PDF 7 días, Uptime Kuma verde, Lighthouse PWA > 95 (objetivo).

```bash
git tag -a v1.0.0 -m "WCreation 1.0.0 — production-ready"
git push origin v1.0.0
```

## Licencia

Ver [LICENSE](./LICENSE).
