# Provisionamiento de dispositivos

Este documento cubre la parte **servidor y certificados**. El **firmware** ESP32/ESP8266 vive en otro repositorio o etapa del proyecto.

## 1. Identidad del dispositivo

- **Número de serie** único (grabado de fábrica o asignado por política del tenant).
- **UUID** `device_id` en Supabase (`wcreation.devices`) vinculado a `tenant_id` y opcionalmente `group_id`.

## 2. Emisión del certificado X.509

```bash
export WCREATION_CA_PASSPHRASE='***'
bash scripts/pki-new-device.sh SN-FARM-042
```

El CN del certificado debe coincidir con el **segmento de tópico** MQTT (`wcreation/<tenant>/<serial>/...`).

## 3. Registro en base operacional

- Registrar el **fingerprint SHA-256** del certificado en la tabla de confianza de dispositivos (cuando esté expuesta vía Supabase/API).
- Verificar políticas **EMQX ACL** (`infra/emqx/etc/acl.conf`) para el tenant y el serial.

## 4. Carga en firmware

1. Incluir `device.crt`, `device.key` y la cadena de verificación de CA adecuada (solo material público de CA + broker según política).
2. Configurar `MQTT_BROKER_URL=mqtts://mqtt.wcreation.ndjota.io:8883`.
3. Probar con el simulador del monorepo:

```bash
pnpm --filter @wcreation/mqtt-bridge simulate-device SN-FARM-042
```

## 5. Renovación del certificado de broker

El certificado de **servidor** del broker (SAN `mqtt.wcreation.ndjota.io`) se firma con la **CA de producto**, no con Let’s Encrypt. Planificar renovación antes del vencimiento (recomendado **≤ 24 meses** de validez) y desplegar nuevos `server.crt` / `server.key` en `/etc/wcreation/certs/broker` con rollout coordinado con firmwares que validen cadena.
