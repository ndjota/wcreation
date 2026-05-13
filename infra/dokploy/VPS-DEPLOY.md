# Despliegue productivo completo en VPS (Dokploy + Traefik)

Guía única para dejar **todos los sistemas** operativos: Supabase (cloud), Timescale + Redis, EMQX (MQTT mTLS), API, PWA, mqtt-bridge, telegram-bot, DNS, certificados y verificaciones finales.

Dominios de referencia del proyecto: `wcreation.ndjota.io`, `api.wcreation.ndjota.io`, `mqtt.wcreation.ndjota.io`, `mqtt-admin.wcreation.ndjota.io`. Sustituí por los tuyos si cambiás marca o DNS.

---

## 0. Supabase (antes del VPS)

1. Proyecto creado (región recomendada São Paulo si operás desde Argentina).
2. **Settings → Data API → Exposed schemas**: incluir **`wcreation`** (obligatorio para API/PWA vía PostgREST con `service_role` y para el cliente autenticado).
3. **Authentication → Providers**: Email habilitado.
4. Migraciones: `bash scripts/supabase-apply-migrations.sh` (o tu pipeline CI).
5. Datos iniciales: `bash scripts/supabase-seed.sh` (o SQL propio).
6. Copiar a Dokploy / secretos: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF` si usás scripts.

Sin el esquema `wcreation` expuesto, verás **PGRST106** y fallarán listados de dispositivos, usuarios, etc.

---

## 1. VPS y host (Ubuntu 24.04 o similar)

1. **Docker** + **Dokploy** instalados; red **`dokploy-network`** creada (externa en los compose del repo).
2. Directorios en el host (ajustá rutas si tu estándar es otro):

   ```bash
   sudo mkdir -p /etc/wcreation/certs/broker /etc/wcreation/certs/ca /etc/wcreation/certs/devices/SN-BRIDGE-001
   sudo mkdir -p /etc/wcreation/emqx
   ```

3. **PKI de producto** (CA, broker para `mqtt.tu-dominio`, cert cliente del bridge **CN=SN-BRIDGE-001**): seguí `docs/device-provisioning.md` y `packages/pki/scripts/`. Copiá al host lo que ya referencia `infra/emqx/etc/emqx.production.conf` (rutas bajo `/mnt/wcreation-certs/...` dentro del contenedor = `/etc/wcreation/certs/...` en el host).
4. **EMQX**: copiá desde el repo al host:

   - `infra/emqx/etc/emqx.production.conf` → `/etc/wcreation/emqx/emqx.conf`
   - `infra/emqx/etc/acl.conf` → `/etc/wcreation/emqx/acl.conf`

5. **Traefik v3**: entrypoints `web` (:80), `websecure` (:443), **`mqtts`** (:8883 TCP passthrough). Let’s Encrypt para HTTP(S). Ver `infra/dokploy/README.md` y `scripts/fix-traefik-ips-wcreation.sh` + trusted IPs si hay proxy delante.

---

## 2. Orden recomendado en Dokploy (Compose)

| Orden | Servicio Dokploy | Archivo |
|-------|------------------|---------|
| 1 | Datos | [compose/timescale-redis.yml](./compose/timescale-redis.yml) |
| 2 | Broker MQTT | [compose/emqx.yml](./compose/emqx.yml) |
| 3 | (Opcional) Uptime Kuma | [compose/uptime-kuma.yml](./compose/uptime-kuma.yml) |

Variables mínimas del compose Timescale (ejemplo):

- `WCREATION_PG_PASSWORD` (fuerte)
- `WCREATION_PG_USER` / `WCREATION_PG_DATABASE` si no usás los defaults del YAML

EMQX:

- `EMQX_DASHBOARD_USERNAME`, `EMQX_DASHBOARD_PASSWORD`
- `TRAEFIK_EMQX_BASIC_AUTH` (htpasswd para Traefik; en `.env` de Dokploy escapar `$$` según documentación Dokploy)

---

## 3. URL interna de Postgres y Redis (apps)

En las **Applications** (API, mqtt-bridge, telegram-bot), `VPS_DATABASE_URL` debe apuntar al servicio Docker, por ejemplo:

```text
postgresql://postgres:TU_PASSWORD@timescaledb:5432/wcreation
```

`REDIS_URL`:

```text
redis://redis:6379
```

Hostname `timescaledb` y `redis` son los definidos en `timescale-redis.yml`. Ajustá usuario/clave/base con lo que configuraste en el compose.

**Migraciones Timescale** en el VPS: aplicá el SQL de `packages/db-vps/migrations/` contra esa base (una sola vez o vía job de release). Sin esto el bridge y el API fallan al leer `wcreation.*` en el VPS.

---

## 4. Applications (build desde raíz del repo)

| App | Dockerfile | Puerto interno | Dominio / red |
|-----|--------------|----------------|---------------|
| API | `apps/api/Dockerfile` | 3001 | `https://api.tu-dominio` |
| PWA | `apps/pwa/Dockerfile` | 80 | `https://tu-dominio` |
| mqtt-bridge | `apps/mqtt-bridge/Dockerfile` | 9090 (solo health) | Sin público; misma red que `emqx`, `timescaledb`, `redis` |
| telegram-bot | `apps/telegram-bot/Dockerfile` | 9090 (health) | Sin público |

**Build context**: siempre la **raíz del monorepo** (donde está `pnpm-lock.yaml`).

### Variables críticas (API + bridge + bot)

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `VPS_DATABASE_URL`, `REDIS_URL`
- `EVENT_SIGNING_KEY` (≥32 caracteres; **misma** en API y mqtt-bridge)
- `PUBLIC_APP_URL=https://tu-dominio`
- `APP_LINK_API_URL=https://api.tu-dominio`
- `CORS_ORIGINS=https://tu-dominio`
- `MQTT_BROKER_URL=mqtts://emqx:8883` (nombre del servicio EMQX)
- **Certificados bridge (rutas absolutas en producción)**, montados como volúmenes desde `/etc/wcreation/certs/...`:
  - `MQTT_CA_PATH`
  - `MQTT_CERT_PATH` (certificado cliente con CN `SN-BRIDGE-001` o el definido en ACL)
  - `MQTT_KEY_PATH`
- `SMTP_*` / `RESEND_API_KEY` si usás email
- `VAPID_*` si usás Web Push
- `TELEGRAM_BOT_TOKEN` (y username) si desplegás el bot

Lista maestra: `.env.example` en la raíz del repo.

### PWA — variables en **build time** (Vite)

Definilas en Dokploy como env disponibles al **build** del Dockerfile:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL=https://api.tu-dominio`
- `VITE_WS_URL=wss://api.tu-dominio`
- `VITE_PUBLIC_PATENTE_REF` (opcional)

Sin `VITE_API_BASE_URL` / `VITE_WS_URL` correctos, el panel no hablará con el API en producción.

---

## 5. Post-deploy: comprobaciones

1. `GET https://api.tu-dominio/health` → 200.
2. `GET https://api.tu-dominio/metrics` (opcional; restringí en Traefik si no debe ser público).
3. PWA: login, listado de dispositivos, dashboard sin error de carga.
4. TCP `mqtt.tu-dominio:8883` (TLS) desde un cliente de prueba o simulador con cert de dispositivo válido.
5. EMQX dashboard vía `mqtt-admin.tu-dominio` con basic auth.
6. Bridge: logs sin error de conexión MQTT ni Postgres; health interno `9090` si lo exponés.
7. `scripts/backup-production.sh` + cron según `docs/operator-runbook.md`.
8. Uptime Kuma: checks HTTP a PWA, `/health` del API, TCP :8883, Postgres (opcional).

---

## 6. Lecturas por componente

- [README Dokploy](./README.md) — Traefik, DNS, tablas de apps.
- [applications/api.md](./applications/api.md)
- [applications/pwa.md](./applications/pwa.md)
- [applications/mqtt-bridge.md](./applications/mqtt-bridge.md)
- [applications/telegram-bot.md](./applications/telegram-bot.md)
- [docs/operator-runbook.md](../../docs/operator-runbook.md)
- [docs/device-provisioning.md](../../docs/device-provisioning.md)

---

## Resumen de dependencias entre piezas

```mermaid
flowchart LR
  subgraph cloud [Supabase Cloud]
    SB[(wcreation + Auth)]
  end
  subgraph vps [VPS]
    T[(Timescale)]
    R[(Redis)]
    E[EMQX]
    A[API]
    P[PWA]
    B[mqtt-bridge]
    TG[telegram-bot]
  end
  P -->|HTTPS REST / WS| A
  A --> SB
  B -->|SQL| T
  B -->|sync| SB
  B -->|MQTT mTLS| E
  A --> T
  A --> R
  TG --> SB
  TG --> T
```

Todo lo anterior debe estar **verde** para un despliegue productivo con “todas las funciones” (ingest MQTT, lecturas en Timescale, operación en Supabase, UI, notificaciones opcionales).
