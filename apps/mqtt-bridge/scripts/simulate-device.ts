/**
 * Simulador de dispositivo ESP32: telemetría MQTT TLS mutuo (cert por número de serie).
 * Uso: pnpm --filter @wcreation/mqtt-bridge simulate-device SN-DEV-001 [--temp-spike] [--power-out]
 */
import { readFileSync } from "node:fs";
import mqtt from "mqtt";
import { mqttTelemetryTopic, mqttEventTopic } from "@wcreation/shared";

async function main(): Promise<void> {
  const serial = process.argv[2];
  if (!serial) {
    console.error("Uso: simulate-device.ts SERIAL_NUMBER [--temp-spike] [--power-out]");
    process.exit(1);
  }

  const flags = new Set(process.argv.slice(3));
  const tenantId = process.env.WCREATION_TENANT_ID ?? "00000000-0000-0000-0000-0000000000aa";
  const broker = process.env.MQTT_BROKER_URL ?? "mqtts://127.0.0.1:8883";
  const caPath = process.env.MQTT_CA_PATH ?? "./certs/broker/cacert.pem";
  const certPath = process.env.MQTT_DEVICE_CERT_PATH ?? `./certs/devices/${serial}/device.crt`;
  const keyPath = process.env.MQTT_DEVICE_KEY_PATH ?? `./certs/devices/${serial}/device.key`;

  const ca = readFileSync(caPath);
  const cert = readFileSync(certPath);
  const key = readFileSync(keyPath);

  const client = mqtt.connect(broker, {
    clientId: `sim-${serial}-${Math.random().toString(16).slice(2, 8)}`,
    protocolVersion: 5,
    rejectUnauthorized: true,
    ca: [ca],
    cert,
    key,
  });

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("error", reject);
  });
  console.log("simulador conectado", serial);

  client.on("error", (e) => {
    console.error(e);
  });

  const telemetryTopic = mqttTelemetryTopic(tenantId, serial);
  const eventTopic = mqttEventTopic(tenantId, serial);

  let tick = 0;
  let tempBase = 4.2;
  let power = true;

  const interval = setInterval(() => {
    tick += 1;
    if (flags.has("--temp-spike") && tick % 6 === 0) tempBase = 12;
    else tempBase = Math.max(2, tempBase - 0.1);
    if (flags.has("--power-out") && tick % 8 === 0) power = false;
    else power = true;

    const body = {
      v: 1 as const,
      ts: new Date().toISOString(),
      temp_interna: tempBase,
      temp_ambiente: 24,
      bateria_pct: 88,
      red_electrica: power,
      puerta_abierta: tick % 20 === 0,
      rssi_wifi: -62,
      fw: "1.0.3-sim",
    };
    client.publish(telemetryTopic, JSON.stringify(body), { qos: 0 });
  }, 5000);

  const eventIv = setInterval(() => {
    const ev = {
      v: 1 as const,
      ts: new Date().toISOString(),
      tipo: "puerta_prolongada" as const,
      severidad: "warning" as const,
      valor: 120,
      umbral: 60,
      contexto: { simulador: true },
    };
    client.publish(eventTopic, JSON.stringify(ev), { qos: 0 });
  }, 30_000);

  const stop = () => {
    clearInterval(interval);
    clearInterval(eventIv);
    client.end(true);
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
