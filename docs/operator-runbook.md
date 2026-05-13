# Runbook del operador

Guía para operar WCreation en producción (VPS Ubuntu 24.04, Dokploy, Traefik v3).

Checklist de despliegue inicial y dependencias entre servicios: **[infra/dokploy/VPS-DEPLOY.md](../infra/dokploy/VPS-DEPLOY.md)**.

## Contactos y secretos

- **Dokploy**: variables de entorno por aplicación (nunca en el repo).
- **Certificados**: `/etc/wcreation/certs` en el host; permisos restrictivos; **la clave privada de la CA no se sube al repo** ni al backup automático sin proceso manual cifrado off-server.

## Monitoreo diario

1. **Uptime Kuma** (recomendado en `uptime.ndjota.io` o instancia dedicada):
   - `GET https://wcreation.ndjota.io/`
   - `GET https://api.wcreation.ndjota.io/health`
   - **TCP** `mqtt.wcreation.ndjota.io:8883` (handshake TLS; puede mostrar “up” si el puerto abre).
   - Consulta Postgres (plugin o script HTTP interno que ejecute `SELECT 1` vía túnel o contenedor en la misma red).
2. **Alertas**: notificaciones a Telegram personal (bot distinto al de producto) si el downtime supera **2 minutos**.
3. **Logs**: JSON en stdout (Pino); revisar en Dokploy sin exponer tokens (el API redacta cabeceras sensibles en producción).
4. **Métricas**: `GET https://api.wcreation.ndjota.io/metrics` (Prometheus; sin auth en v1 — restringir por red o Traefik IP allowlist si hace falta).

## Alta de un nuevo cliente (tenant)

1. **Supabase** (SQL o Studio): insertar fila en `wcreation.tenants` con `razon_social` y datos fiscales mínimos requeridos.
2. Crear **grupo** (`wcreation.groups`) y, si aplica, **dispositivos** en `wcreation.devices` con `tenant_id` y `serial_number` alineado al CN del certificado.
3. **Supabase Auth**: crear usuario con email; en `wcreation.users` enlazar `id` = `auth.users.id`, `role_code = 'owner_admin'`, `tenant_id` del tenant.
4. **Umbrales**: `wcreation.device_thresholds` por dispositivo (vía API autenticado o SQL).
5. **VPS**: no hace falta crear tablas por tenant; el aislamiento es lógico por `tenant_id` y RLS en Supabase; Timescale almacena por `device_id` UUID.

## Provisionar un dispositivo nuevo

Ver [device-provisioning.md](./device-provisioning.md). Resumen: emitir cert con `scripts/pki-new-device.sh`, registrar fingerprint en Supabase cuando exista la tabla de certificados operativa, cargar paths en firmware (fuera de este repo).

## Rotación de certificado comprometido

1. Revocar / dejar de confiar en el cert en EMQX (lista de revocación o eliminación del CN en ACL si aplica).
2. Emitir nuevo certificado con el **mismo serial** o política de re-serialización acordada con el cliente.
3. Actualizar registro en base operacional y en dispositivo físico.

## Restaurar un backup

1. Detener `mqtt-bridge` (evitar escrituras inconsistentes) si restaurás solo Timescale.
2. Descomprimir el archivo diario `daily-*.tar` generado por `scripts/backup-production.sh`.
3. Restaurar Postgres: `pg_restore` o `pg_restore -Fc` según el archivo `.dump.zst` (descomprimir con `zstd -d` antes).
4. Restaurar fragmentos Traefik desde `traefik-dynamic-*.tar.gz` solo si corresponde a un desastre de configuración.
5. Certificados cifrados: `gpg --decrypt certs-*.tar.gz.gpg` y volver a colocar bajo `/etc/wcreation/certs` con permisos correctos.

## Escalado (> ~1000 dispositivos)

- Mover **TimescaleDB** a un nodo dedicado o servicio gestionado; ajustar `VPS_DATABASE_URL` y límites de conexión del pool en API/bridge.
- **EMQX**: cluster o plan EMQX Cloud; actualizar DNS y certificados.
- **API**: réplicas stateless detrás de Traefik; WebSocket con sticky sessions o migración a canal Redis/SSE según evolución.
- **Redis**: instancia con más RAM o cluster ElastiCache-compatible.

## Seguridad — checklist final

- [ ] Firewall: solo **22, 80, 443, 8883** hacia Internet.
- [ ] SSH solo con **clave**, password deshabilitado.
- [ ] Dashboard EMQX: usuario fuerte y **contraseña distinta del default** (`EMQX_DASHBOARD_PASSWORD`).
- [ ] Supabase: **RLS** en todas las tablas `wcreation` — test `SUPABASE_DB_URL=... pnpm vitest run tests/supabase-rls.test.ts`.
- [ ] API: **100 req/min por IP**, **1000 req/min por usuario**; QR público **30 req/min por IP** en rutas `/public/qr/*`.
- [ ] PWA: **CSP** estricta y **HSTS** vía nginx (y HSTS en respuestas API detrás de Traefik).
- [ ] **CORS**: solo `https://wcreation.ndjota.io` en producción (`CORS_ORIGINS` si necesitás más orígenes).
- [ ] Secretos solo en Dokploy; logs sin JWT completos (redacción Pino en prod).
- [ ] Política de retención documentada en [data-retention.md](./data-retention.md).

## Traefik: entrypoint MQTT y confianza de IPs

1. Declarar en Traefik un entrypoint **`mqtts`** en `:8883` (modo TCP).
2. Ejecutar `bash scripts/fix-traefik-ips-wcreation.sh` y fusionar el fragmento de **trustedIPs** con la configuración NDJota del host.
3. **EMQX dashboard**: variable `TRAEFIK_EMQX_BASIC_AUTH` con valor `htpasswd` (`openssl passwd -apr1`).

## Cron de backups

```cron
15 3 * * * VPS_DATABASE_URL=... BACKUP_GPG_PASSPHRASE=... RCLONE_REMOTE=r2:wcrepo/prod /opt/wcreation/scripts/backup-production.sh >> /var/log/wcreation-backup.log 2>&1
```

Configurar **lifecycle** en R2/B2: prefijos `daily/`, `weekly/`, `monthly/` según política (7 d / 4 sem / 12 m).

## Verificación end-to-end (producción)

1. PWA carga y pide login.
2. Superadmin accede al dashboard.
3. Crear tenant de prueba y `owner_admin`.
4. Provisionar dispositivo (cert + registro).
5. Simulador contra MQTT producción; datos en dashboard y alertas.
6. QR público legible desde móvil.
7. Push, email y Telegram de producto al disparar evento.
8. PDF 7 días desde flujo público o autenticado.
9. Uptime Kuma en verde.
10. Lighthouse PWA > 95 en performance y PWA (objetivo; depende de red y datos reales).
