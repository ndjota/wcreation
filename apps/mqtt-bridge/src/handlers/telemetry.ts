import { z } from "zod";
import type { Pool } from "pg";
import type { BridgeConfig } from "../config.js";
import { evaluateThresholds } from "../lib/thresholds.js";
import { publishDeviceChannel } from "../lib/publisher.js";
import type { RedisConn } from "../redis-types.js";

const telemetrySchema = z.object({
  v: z.literal(1),
  ts: z.string(),
  temp_interna: z.number(),
  temp_ambiente: z.number(),
  bateria_pct: z.number().int().min(0).max(100),
  red_electrica: z.boolean(),
  puerta_abierta: z.boolean(),
  rssi_wifi: z.number().int(),
  fw: z.string().min(1),
});

export async function handleTelemetry(params: {
  pool: Pool;
  redis: RedisConn;
  cfg: BridgeConfig;
  log: { warn: (o: object, m?: string) => void; info: (o: object, m?: string) => void };
  tenantId: string;
  topicSegment: string;
  payload: unknown;
}): Promise<void> {
  const parsed = telemetrySchema.safeParse(params.payload);
  if (!parsed.success) {
    params.log.warn({ issues: parsed.error.flatten() }, "telemetry inválido");
    return;
  }
  const body = parsed.data;

  const r = await params.pool.query(
    `SELECT id, tenant_id, serial_number FROM wcreation.devices_replica
     WHERE serial_number = $1 AND tenant_id = $2::uuid AND activo = true`,
    [params.topicSegment, params.tenantId],
  );
  const row = r.rows[0] as { id: string; tenant_id: string; serial_number: string } | undefined;
  if (!row) {
    params.log.warn({ tenantId: params.tenantId, seg: params.topicSegment }, "dispositivo no réplica");
    return;
  }

  await params.pool.query(
    `INSERT INTO wcreation.readings
      (ts, device_id, temp_interna, temp_ambiente, bateria_pct, red_electrica, puerta_abierta, rssi_wifi, firmware_version)
     VALUES ($1::timestamptz, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (device_id, ts) DO NOTHING`,
    [
      body.ts,
      row.id,
      body.temp_interna,
      body.temp_ambiente,
      body.bateria_pct,
      body.red_electrica,
      body.puerta_abierta,
      body.rssi_wifi,
      body.fw,
    ],
  );

  const lastJson = JSON.stringify({
    ts: body.ts,
    temp_interna: body.temp_interna,
    temp_ambiente: body.temp_ambiente,
    bateria_pct: body.bateria_pct,
    red_electrica: body.red_electrica,
    puerta_abierta: body.puerta_abierta,
    rssi_wifi: body.rssi_wifi,
    fw: body.fw,
  });
  await params.redis.set(`wcreation:device:${row.id}:last`, lastJson, "EX", 3600);

  await publishDeviceChannel(params.redis, row.id, {
    type: "reading",
    device_id: row.id,
    data: JSON.parse(lastJson) as Record<string, unknown>,
    ts: body.ts,
  });

  const internal = await evaluateThresholds({
    pool: params.pool,
    redis: params.redis,
    supabaseUrl: params.cfg.SUPABASE_URL,
    supabaseKey: params.cfg.SUPABASE_SERVICE_ROLE_KEY,
    deviceId: row.id,
    tenantId: row.tenant_id,
    reading: body,
    signingKey: params.cfg.EVENT_SIGNING_KEY,
    log: params.log,
  });
  if (internal) {
    await publishDeviceChannel(params.redis, row.id, {
      type: "event",
      device_id: row.id,
      event: internal,
      ts: internal.ts,
    });
  }
}
