# WCreation v1.0.0 — Release notes

Fecha: 13 de mayo de 2026.

## Resumen

Primera versión **production-ready** del sistema de control y certificación de cadena de frío: monorepo desplegable en **Dokploy** (Hostinger, Ubuntu 24.04, Traefik v3), broker **EMQX** con TLS mutuo y certificado de servidor de **CA propia**, datos temporales en **TimescaleDB** y operativo en **Supabase** con RLS multi-tenant, PWA en **React + Vite** con cabeceras de seguridad en **nginx**, observabilidad mínima (**health**, **TCP MQTT**, **`/metrics`** en API, **Uptime Kuma**) y respaldos documentados.

## Destacado operativo

- Dominios públicos: `wcreation.ndjota.io`, `api.wcreation.ndjota.io`, `mqtt.wcreation.ndjota.io:8883`, `mqtt-admin.wcreation.ndjota.io`.
- Variables sensibles solo en **Dokploy** / secretos del host (`/etc/wcreation/certs`); la **clave privada de la CA no se respalda** en el script automático (procedimiento manual cifrado off-server).
- **Cloudflare R2** recomendado como destino económico para backups (lifecycle: diarios 7 d, semanales 4 sem, mensuales 12 mes en el panel del bucket).

## Criterio de cierre

Ver lista de verificación en `docs/operator-runbook.md` y la sección “Verificación final” del README principal.

## Migraciones

Las migraciones **Supabase** y **Timescale** siguen en `packages/db-supabase/migrations` y `packages/db-vps/migrations`; aplicarlas antes del primer deploy en un entorno nuevo.

## Tag Git

```bash
git tag -a v1.0.0 -m "WCreation 1.0.0 — production-ready"
git push origin v1.0.0
```
