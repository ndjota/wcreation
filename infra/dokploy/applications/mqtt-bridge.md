# Dokploy — Application `apps/mqtt-bridge`

- **Tipo**: Application → Docker.
- **Repositorio**: `ndjota/wcreation`, rama `main`.
- **Build context**: raíz del monorepo.
- **Dockerfile**: `apps/mqtt-bridge/Dockerfile`.
- **Dominio público**: ninguno.
- **Red**: misma `dokploy-network` que `emqx`, `timescaledb`, `redis`.
- **MQTT_BROKER_URL**: `mqtts://emqx:8883` (hostname del servicio EMQX).
- **Restart**: `unless-stopped` (política Dokploy / Docker).

## Volúmenes

Montar lectura de certificados cliente y CA en las rutas definidas por `MQTT_CA_PATH`, `MQTT_CERT_PATH`, `MQTT_KEY_PATH`.

## Health

`HEALTH_LISTEN_PORT=9090` — `GET http://127.0.0.1:9090/health` (uso interno / Dokploy HTTP health si exponés puerto en red privada).
