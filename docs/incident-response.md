# Respuesta a incidentes

## El API no responde o devuelve 5xx

1. Revisar `GET /health` (degradado indica Postgres, Redis o Supabase).
2. Ver logs del contenedor en Dokploy.
3. Si Postgres del VPS está caído: revisar disco y `docker compose` de Timescale; restaurar desde backup si hace falta.

## El bridge no ingiere MQTT

1. `GET` al **health HTTP** del bridge (`HEALTH_LISTEN_PORT`, p. ej. 9090 en Docker) — campo `mqtt_connected`.
2. Verificar certificados cliente y ACL EMQX.
3. Probar `openssl s_client -connect mqtt.wcreation.ndjota.io:8883` con cert de prueba.

## EMQX no acepta conexiones

1. Traefik: router TCP **passthrough** y entrypoint `mqtts` en `:8883`.
2. Certificado de servidor vigente y cadena coherente con la CA embarcada en dispositivos.
3. Dashboard interno en `mqtt-admin` con credenciales fuertes.

## Supabase / Auth

1. Estado del proyecto en panel Supabase.
2. Rotación de claves JWKS: el API usa JWKS remoto; fallos intermitentes pueden deberse a red o a incidente Supabase.

## Pérdida total del VPS

1. Restaurar desde backups en R2/B2 (Postgres + Traefik + certs cifrados).
2. Reinstalar Dokploy/Traefik según NDjota.
3. Rotar secretos si la confidencialidad del backup no está garantizada.

## Comunicaciones

- Notificar al cliente afectado según SLA.
- Registrar postmortem breve: causa raíz, tiempo de detección, tiempo de recuperación, acciones preventivas.
