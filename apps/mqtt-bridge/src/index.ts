import { createServer } from "node:http";
import pino from "pino";
import pg from "pg";
import { Redis } from "ioredis";
import { loadBridgeConfig } from "./config.js";
import { connectMqtt } from "./mqtt-client.js";
import { handleTelemetry } from "./handlers/telemetry.js";
import { handleDeviceEvent } from "./handlers/event.js";
import { handleStatus } from "./handlers/status.js";
import { startSyncWorker } from "./workers/sync.js";

const log =
  process.env.NODE_ENV === "development"
    ? pino({ transport: { target: "pino-pretty", options: { colorize: true } } })
    : pino();

const cfg = loadBridgeConfig();
const pool = new pg.Pool({ connectionString: cfg.VPS_DATABASE_URL, max: 10 });
const redis = new Redis(cfg.REDIS_URL);

function parseTopic(
  topic: string,
): { tenantId: string; segment: string; kind: "telemetry" | "event" | "status" } | null {
  const p = topic.split("/");
  if (p[0] !== "wcreation" || p.length < 4) return null;
  const tenantId = p[1]!;
  const segment = p[2]!;
  const rest = p.slice(3).join("/");
  if (rest === "telemetry") return { tenantId, segment, kind: "telemetry" };
  if (rest === "event") return { tenantId, segment, kind: "event" };
  if (rest === "status") return { tenantId, segment, kind: "status" };
  return null;
}

const stopSync = startSyncWorker({ pool, cfg, log });

const client = connectMqtt(cfg, log);

await new Promise<void>((resolve, reject) => {
  client.once("connect", () => resolve());
  client.once("error", reject);
});

await new Promise<void>((resolve, reject) => {
  client.subscribe(
    { "wcreation/+/+/telemetry": { qos: 0 }, "wcreation/+/+/event": { qos: 0 }, "wcreation/+/+/status": { qos: 0 } },
    (err) => (err ? reject(err) : resolve()),
  );
});

client.on("message", async (topic, payload) => {
  try {
    const parsed = parseTopic(topic);
    if (!parsed) return;
    const raw = JSON.parse(payload.toString("utf8")) as unknown;
    if (parsed.kind === "telemetry") {
      await handleTelemetry({
        pool,
        redis,
        cfg,
        log,
        tenantId: parsed.tenantId,
        topicSegment: parsed.segment,
        payload: raw,
      });
    } else if (parsed.kind === "event") {
      await handleDeviceEvent({
        pool,
        redis,
        cfg,
        log,
        tenantId: parsed.tenantId,
        topicSegment: parsed.segment,
        payload: raw,
      });
    } else {
      await handleStatus({ pool, cfg, log, tenantId: parsed.tenantId, topicSegment: parsed.segment, payload: raw });
    }
  } catch (e) {
    log.error({ err: String(e), topic }, "message handler");
  }
});

log.info("mqtt-bridge listo");

const healthPort = Number(process.env.HEALTH_LISTEN_PORT ?? 0);
if (healthPort > 0) {
  const server = createServer((req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.stringify({
      status: client.connected ? "ok" : "degraded",
      mqtt_connected: client.connected,
    });
    res.writeHead(client.connected ? 200 : 503, { "Content-Type": "application/json" }).end(body);
  });
  server.listen(healthPort, "0.0.0.0", () => {
    log.info({ port: healthPort }, "health HTTP");
  });
}

const shutdown = async () => {
  stopSync();
  client.end(true);
  await pool.end();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
