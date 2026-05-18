# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WCreation is a professional **cold-chain control and certification system** for pharmacies, hospitals, and supermarkets. ESP32 devices publish telemetry via **MQTT over mutual TLS (X.509)**; the backend persists time-series in **TimescaleDB** and operational data in **Supabase Cloud**.

## Prerequisites

- Node 22, pnpm 9+, Docker Desktop, OpenSSL, psql client

## Development Commands

### Infrastructure (Docker)

```bash
pnpm dev                # Start all containers in foreground (TimescaleDB, Redis, EMQX, Mailhog)
pnpm dev:detach         # Start containers in background
pnpm dev:down           # Stop containers
```

### App Dev Servers

```bash
pnpm dev:api            # Fastify API at :3001 (hot-reload via tsx watch)
pnpm dev:bridge         # MQTT ingest bridge (hot-reload via tsx watch)
pnpm dev:pwa            # Vite PWA at :5173 (hot-reload)
pnpm dev:telegram       # Telegram bot (hot-reload via tsx watch)
pnpm dev:all            # All apps via scripts/dev-local.sh
```

### Build, Lint, Typecheck

```bash
pnpm build              # Build all packages recursively
pnpm lint               # ESLint all packages (0 warnings allowed)
pnpm typecheck          # TypeScript check all packages
pnpm -r run build       # Same as pnpm build (explicit)

# Single app
pnpm --filter @wcreation/api build
pnpm --filter @wcreation/pwa lint
```

### Tests

```bash
pnpm test               # Vitest runs tests in packages/**/*, apps/**/*, tests/**/*
```

The RLS test (`tests/supabase-rls.test.ts`) requires `SUPABASE_DB_URL` — it skips silently without it.

### Initial Setup

```bash
cp .env.example .env
pnpm install
export WCREATION_CA_PASSPHRASE='your-passphrase-8+'  # or the script will prompt
bash scripts/setup.sh          # PKI init, DB migrations, EMQX config
bash scripts/seed-dev.sh       # Supabase seed + device cert SN-DEV-001 + SN-BRIDGE-001
bash scripts/healthcheck.sh    # Verify all services are up
```

### Device Simulation & E2E

```bash
pnpm --filter @wcreation/mqtt-bridge simulate-device SN-DEV-001
bash scripts/test-e2e.sh       # Full E2E: spins compose + API + bridge + 30s simulation
pnpm emulator                  # Lab emulator (multiple devices)
```

### Supabase

```bash
bash scripts/supabase-apply-migrations.sh   # Push migrations to Supabase Cloud
bash scripts/supabase-seed.sh               # Seed demo users/tenants
pnpm supabase:option-b                      # Guided setup (option B flow)
```

### Adding a New Device (PKI)

```bash
bash scripts/pki-new-device.sh SN-FARM-042
# Then register the printed SHA-256 fingerprint in the certificates table via API
```

### Docker Builds (production context)

```bash
docker build -f apps/api/Dockerfile -t wcreation-api:1.0.0 .
# Build context must be the repo root — all Dockerfiles require it
```

## Architecture

### Dual Database Design

The project uses two databases intentionally:

- **TimescaleDB (VPS)** — time-series data: `readings`, `events`, hypertable materializations. Accessed directly via `pg` in `apps/api` and `apps/mqtt-bridge`. Migrations live in `packages/db-vps`.
- **Supabase Cloud (Postgres + Auth + Storage)** — operational/multi-tenant data in the `wcreation` schema: `tenants`, `users`, `devices`, `groups`, `certificates`, push subscriptions, Telegram links. Row-Level Security (RLS) enforced on all tables. Migrations live in `supabase/migrations/`. Must expose the `wcreation` schema in Supabase Dashboard → Settings → Data API.

### Data Flow

```
ESP32 → EMQX (mTLS :8883) → mqtt-bridge → TimescaleDB (readings/events)
                                        → Redis (live state, pub/sub)
                                        → Supabase (sync device state)

PWA ←→ API (REST + WebSocket JWT) → TimescaleDB + Redis + Supabase + Storage
Telegram bot → Supabase + TimescaleDB
```

### MQTT Topic Convention

`wcreation/<tenant_uuid>/<serial_number>/telemetry` (and `/status`, `/event`)

Device identity = the **CN of its X.509 certificate**. The broker uses a private CA (not Let's Encrypt) so firmware can embed only the product CA.

### API (`apps/api`) — Fastify 5

- Entry: `src/index.ts` → `src/server.ts`
- Plugins: `src/plugins/` — `auth.ts` (JWT via JWKS from Supabase, not a static key), `db-vps.ts` (TimescaleDB pool), `db-supabase.ts`, `redis.ts`, `metrics.ts`
- Routes: `src/routes/` — `readings`, `events`, `devices`, `thresholds`, `reports`, `dashboard`, `ws` (WebSocket), `public` (QR token), `admin`, `notifications`
- Services: `src/services/` — business logic for cold-chain reports, QR, notifications, sync, permissions
- Swagger UI at `/docs`; Prometheus metrics at `/metrics`

### MQTT Bridge (`apps/mqtt-bridge`)

- `src/mqtt-client.ts` — MQTT connection with mTLS client cert
- `src/handlers/telemetry.ts`, `event.ts`, `status.ts` — per-topic message handlers
- `src/workers/sync.ts` — periodic sync of device state to Supabase
- `src/lib/signing.ts` — HMAC signing of events (shared `EVENT_SIGNING_KEY` with API)

### PWA (`apps/pwa`) — React + Vite + TanStack Router

- File-based routing via TanStack Router: `src/routes/` — `_authed/` (protected), `login`, `qr/$token`, `reports/verify.$reportId`
- UI: Radix UI primitives + Tailwind CSS, components in `src/components/`
- Real-time: `src/hooks/useDeviceLive.ts` WebSocket hook → `src/lib/ws.ts`
- Auth: Supabase Auth client in `src/lib/supabase.ts`, role-based guards in `src/components/shared/RoleGuard.tsx`
- i18n: `es-AR` (default) and `en` via `react-i18next`
- In dev, Vite proxies `/api` to the local API (`VITE_API_BASE_URL` empty = proxy)

### Shared Packages

- `packages/shared` (`@wcreation/shared`) — MQTT topic schemas, JSON schemas, shared types and event-signing utilities (`/signing` subpath)
- `packages/notify-core` (`@wcreation/notify-core`) — notification dispatch logic shared by API and bridge

### Role Hierarchy (Supabase)

| Role | Hierarchy |
|------|-----------|
| `superadmin` | 100 — no tenant; global platform admin |
| `owner_admin` | 80 — manages their full tenant |
| `responsable` | 50 — branch/operation scope |
| `public_viewer` | 10 — read-only via QR token |

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `EVENT_SIGNING_KEY` | HMAC signing key (≥32 chars) — must match between API and mqtt-bridge |
| `VPS_DATABASE_URL` | TimescaleDB connection string |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase backend access |
| `MQTT_CERT_PATH` / `MQTT_KEY_PATH` / `MQTT_CA_PATH` | Bridge client certs |
| `WCREATION_CA_PASSPHRASE` | PKI CA passphrase for cert scripts |
| `VITE_*` | PWA build-time variables injected by Vite |

## Code Standards

- **TypeScript strict** across the entire monorepo (`tsconfig.base.json`)
- **ESLint** flat config at repo root + per-app; **Prettier** via `prettier.config.cjs`
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `deploy:`, `ops:`
- All workspace packages use `"type": "module"` (ESM throughout)

## Local Services (dev)

| Service | URL |
|---------|-----|
| API | http://localhost:3001 (Swagger: /docs) |
| PWA | http://localhost:5173 |
| EMQX Dashboard | http://localhost:18083 (`admin` / `public`) |
| Mailhog | http://localhost:8025 |
| TimescaleDB | `localhost:5433` |
| Redis | `localhost:6379` |
