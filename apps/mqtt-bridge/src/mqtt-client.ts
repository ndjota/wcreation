import { readFileSync } from "node:fs";
import mqtt, { type MqttClient } from "mqtt";
import type { BridgeConfig } from "./config.js";

export function connectMqtt(cfg: BridgeConfig, log: { info: (o: object, m?: string) => void }): MqttClient {
  const ca = readFileSync(cfg.MQTT_CA_PATH);
  const cert = readFileSync(cfg.MQTT_CERT_PATH);
  const key = readFileSync(cfg.MQTT_KEY_PATH);

  const client = mqtt.connect(cfg.MQTT_BROKER_URL, {
    clientId: cfg.MQTT_CLIENT_ID,
    protocolVersion: 5,
    rejectUnauthorized: true,
    ca: [ca],
    cert,
    key,
    reconnectPeriod: 3000,
    connectTimeout: 15_000,
  });

  client.on("connect", () => {
    log.info({ broker: cfg.MQTT_BROKER_URL }, "MQTT conectado");
  });
  client.on("error", (err) => {
    log.info({ err: String(err) }, "MQTT error");
  });

  return client;
}
