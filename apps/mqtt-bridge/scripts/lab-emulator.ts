/**
 * Emulador de laboratorio: MQTT TLS (mTLS) hacia EMQX con telemetría y status.
 *
 * Uso (desde la raíz del repo):
 *   pnpm emulator
 *   pnpm emulator -- --init
 *   pnpm emulator -- --config /ruta/archivo.json
 *
 * Si existe scripts/emulator/lab-state.json se usa por defecto (menú interactivo).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import mqtt from "mqtt";
import { mqttEventTopic, mqttStatusTopic, mqttTelemetryTopic } from "@wcreation/shared";
import {
  defaultConfigPath,
  getRepoRoot,
  initSupabaseThresholds,
  labStatePath,
  loadLabConfig,
  type LabConfig,
  type LabDevice,
} from "./lab-config.js";

loadDotenv({ path: path.join(getRepoRoot(), ".env") });

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function sampleRange(
  rng: () => number,
  spec: { center: number; amplitude: number; min: number; max: number },
): number {
  const wobble = (rng() * 2 - 1) * spec.amplitude;
  return clamp(spec.center + wobble, spec.min, spec.max);
}

function resolveConfigPath(): string {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf("--config");
  const fromEnv = process.env.EMULATOR_CONFIG?.trim();
  if (idx >= 0 && argv[idx + 1]) return path.resolve(argv[idx + 1]!);
  if (fromEnv && fromEnv.length > 0) return path.resolve(fromEnv);
  const state = labStatePath();
  if (existsSync(state)) return state;
  return defaultConfigPath();
}

function connectDevice(params: {
  cfg: LabConfig;
  dev: LabDevice;
  broker: string;
  caPath: string;
}): { stop: () => void } {
  const { cfg, dev, broker, caPath } = params;
  const certPath = path.join(getRepoRoot(), "certs", "devices", dev.serial, "device.crt");
  const keyPath = path.join(getRepoRoot(), "certs", "devices", dev.serial, "device.key");

  const ca = readFileSync(caPath);
  const cert = readFileSync(certPath);
  const key = readFileSync(keyPath);

  const client = mqtt.connect(broker, {
    clientId: `lab-${dev.serial}-${Math.random().toString(16).slice(2, 8)}`,
    protocolVersion: 5,
    rejectUnauthorized: true,
    ca: [ca],
    cert,
    key,
  });

  const telemetryTopic = mqttTelemetryTopic(cfg.tenant_id, dev.serial);
  const statusTopic = mqttStatusTopic(cfg.tenant_id, dev.serial);
  const eventTopic = mqttEventTopic(cfg.tenant_id, dev.serial);

  const seed = dev.random_seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = mulberry32(seed);
  let tick = 0;

  const publishStatus = (estado: "online" | "offline") => {
    const body = { v: 1 as const, ts: new Date().toISOString(), estado };
    client.publish(statusTopic, JSON.stringify(body), { qos: 0 });
  };

  const publishTelemetryOnce = () => {
    tick += 1;
    const t = dev.telemetry;
    const temp_interna = sampleRange(rng, t.temp_interna);
    const temp_ambiente = sampleRange(rng, t.temp_ambiente);
    const bateria_pct = Math.round(sampleRange(rng, t.bateria_pct));
    const rssi_wifi = Math.round(sampleRange(rng, t.rssi_wifi));
    const puerta_abierta = t.door_open_every_ticks > 0 && tick % t.door_open_every_ticks === 0;
    const red_electrica =
      t.power_loss_every_ticks <= 0 ? true : !(tick % t.power_loss_every_ticks === 0 && tick > 0);

    const body = {
      v: 1 as const,
      ts: new Date().toISOString(),
      temp_interna,
      temp_ambiente,
      bateria_pct,
      red_electrica,
      puerta_abierta,
      rssi_wifi,
      fw: t.fw,
    };
    client.publish(telemetryTopic, JSON.stringify(body), { qos: 0 });
  };

  const maybeEvent = () => {
    if (tick > 0 && tick % 18 === 0) {
      const ev = {
        v: 1 as const,
        ts: new Date().toISOString(),
        tipo: "puerta_prolongada" as const,
        severidad: "warning" as const,
        valor: 90,
        umbral: 60,
        contexto: { emulador: "lab", serial: dev.serial },
      };
      client.publish(eventTopic, JSON.stringify(ev), { qos: 0 });
    }
  };

  let teleIv: ReturnType<typeof setInterval> | undefined;
  let statIv: ReturnType<typeof setInterval> | undefined;

  client.once("connect", () => {
    console.log("[lab-emulator] MQTT conectado:", dev.serial, telemetryTopic);
    publishStatus("online");
    publishTelemetryOnce();
    teleIv = setInterval(() => {
      publishTelemetryOnce();
      maybeEvent();
    }, dev.telemetry_interval_ms);
    statIv = setInterval(() => publishStatus("online"), dev.status_interval_ms);
  });

  client.on("error", (e) => {
    console.error("[lab-emulator]", dev.serial, e);
  });

  const stop = () => {
    if (teleIv) clearInterval(teleIv);
    if (statIv) clearInterval(statIv);
    if (client.connected) {
      try {
        publishStatus("offline");
      } catch {
        /* ignore */
      }
    }
    client.end(true);
  };

  return { stop };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const init = argv.includes("--init");
  const configPath = resolveConfigPath();
  console.log("[lab-emulator] Config:", configPath);
  const lab = loadLabConfig(configPath);

  if (init) {
    await initSupabaseThresholds(lab);
  }

  const broker = process.env.MQTT_BROKER_URL ?? "mqtts://127.0.0.1:8883";
  const caPath = process.env.MQTT_CA_PATH ?? path.join(getRepoRoot(), "certs", "broker", "cacert.pem");

  const active = lab.devices.filter((d) => d.enabled);
  if (active.length === 0) {
    console.error("[lab-emulator] Ningún dispositivo con enabled=true. Usá: pnpm emulator:menu");
    process.exit(1);
  }

  const stoppers: Array<() => void> = [];
  for (const dev of active) {
    stoppers.push(connectDevice({ cfg: lab, dev, broker, caPath }).stop);
  }

  const shutdown = () => {
    for (const s of stoppers) s();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(
    "[lab-emulator] Publicando telemetría (EMQX + bridge + API). Ctrl+C para salir.",
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
