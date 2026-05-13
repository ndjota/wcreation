# Dokploy — WCreation (producción)

Configuración de referencia para **Dokploy** sobre **Ubuntu 24.04** con **Traefik v3**. Repositorio: `ndjota/wcreation`, rama `main`, auto-deploy on push.

## DNS (Hostinger)

Registros **A** → `168.231.117.14`:

- `wcreation.ndjota.io`
- `api.wcreation.ndjota.io`
- `mqtt.wcreation.ndjota.io`
- `mqtt-admin.wcreation.ndjota.io`

## Traefik global

1. Entrypoints **`web`** (`:80`), **`websecure`** (`:443`) y **`mqtts`** (`:8883` TCP).
2. Cert resolver **Let’s Encrypt** para HTTP(S).
3. Ejecutar `bash scripts/fix-traefik-ips-wcreation.sh` y aplicar **trustedIPs** según el README de **NDjota Infrastructure** (proxies delante del VPS).

## Compose administrados (Service → Docker Compose)

| Archivo | Uso |
|---------|-----|
| [compose/timescale-redis.yml](./compose/timescale-redis.yml) | Postgres Timescale + Redis en red `dokploy-network` |
| [compose/emqx.yml](./compose/emqx.yml) | EMQX 5.8 con volúmenes y labels Traefik |
| [compose/uptime-kuma.yml](./compose/uptime-kuma.yml) | Uptime Kuma (opcional) |

Antes de levantar EMQX, copiá en el host:

- `infra/emqx/etc/emqx.production.conf` → `/etc/wcreation/emqx/emqx.conf`
- `infra/emqx/etc/acl.conf` → `/etc/wcreation/emqx/acl.conf`
- Certificados broker + CA bajo `/etc/wcreation/certs/...`

Variables EMQX en Dokploy: `EMQX_DASHBOARD_USERNAME`, `EMQX_DASHBOARD_PASSWORD`, `TRAEFIK_EMQX_BASIC_AUTH` (usuarios `htpasswd` para Traefik).

## Aplicaciones (Application)

Cada app: **Build type** Docker, contexto del repositorio en la **raíz**, Dockerfile en la ruta indicada.

| App | Dockerfile | Dominio / puerto interno | Recursos sugeridos |
|-----|------------|--------------------------|---------------------|
| API | `apps/api/Dockerfile` | `api.wcreation.ndjota.io` → contenedor **3001** | 512 MB RAM, 0.5 CPU |
| PWA | `apps/pwa/Dockerfile` | `wcreation.ndjota.io` → **80** | 256 MB RAM, 0.25 CPU |
| mqtt-bridge | `apps/mqtt-bridge/Dockerfile` | sin HTTP público | 512 MB RAM, 0.5 CPU |
| telegram-bot | `apps/telegram-bot/Dockerfile` | sin HTTP público | 256 MB RAM, 0.25 CPU |

Healthchecks Docker ya definidos en API / PWA / workers. Para workers, exponé **9090** solo en red interna si querés health desde Traefik (no es obligatorio).

### Variables comunes (API + bridge + bot)

Tomá como lista maestra `/.env.example` en la raíz del repo. En producción destacados:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `VPS_DATABASE_URL` → URL al servicio `timescaledb` (hostname Docker `timescaledb`)
- `REDIS_URL` → `redis://redis:6379`
- `MQTT_BROKER_URL` → `mqtts://emqx:8883` (nombre del servicio EMQX en la misma red)
- `EVENT_SIGNING_KEY` (≥32 caracteres, compartida API + bridge)
- `PUBLIC_APP_URL=https://wcreation.ndjota.io`
- `APP_LINK_API_URL=https://api.wcreation.ndjota.io`
- `CORS_ORIGINS=https://wcreation.ndjota.io` (coma si hay más orígenes)
- Email, VAPID, Telegram según entrega

### PWA (build args / env de build Vite)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL=https://api.wcreation.ndjota.io`, `VITE_WS_URL=wss://api.wcreation.ndjota.io`

### mqtt-bridge / telegram-bot

- Certificados TLS cliente montados como volúmenes en rutas referenciadas por `MQTT_*_PATH`.
- `HEALTH_LISTEN_PORT=9090` (ya fijado en Dockerfile de bridge; telegram igual si usás healthcheck).

## Backups y cron

Ver `scripts/backup-production.sh` y `docs/operator-runbook.md`.

## Lecturas por aplicación

- [applications/api.md](./applications/api.md)
- [applications/pwa.md](./applications/pwa.md)
- [applications/mqtt-bridge.md](./applications/mqtt-bridge.md)
- [applications/telegram-bot.md](./applications/telegram-bot.md)
