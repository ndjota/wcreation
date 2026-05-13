import { z } from "zod";
import type { Pool } from "pg";
import type { BridgeConfig } from "../config.js";
import { insertSignedEvent } from "../lib/signing.js";
import { publishDeviceChannel } from "../lib/publisher.js";
import type { RedisConn } from "../redis-types.js";

const eventSchema = z.object({
  v: z.literal(1),
  ts: z.string(),
  tipo: z.enum([
    "umbral_excedido_temp",
    "corte_red",
    "puerta_prolongada",
    "bateria_baja",
    "dispositivo_offline",
    "configuracion_modificada",
    "cadena_frio_perdida",
  ]),
  severidad: z.enum(["info", "warning", "critical"]),
  valor: z.number().optional(),
  umbral: z.number().optional(),
  contexto: z.record(z.unknown()).optional(),
});

export async function handleDeviceEvent(params: {
  pool: Pool;
  redis: RedisConn;
  cfg: BridgeConfig;
  log: { warn: (o: object, m?: string) => void };
  tenantId: string;
  topicSegment: string;
  payload: unknown;
}): Promise<void> {
  const parsed = eventSchema.safeParse(params.payload);
  if (!parsed.success) {
    params.log.warn({ issues: parsed.error.flatten() }, "evento dispositivo inválido");
    return;
  }
  const body = parsed.data;

  const r = await params.pool.query(
    `SELECT id, tenant_id FROM wcreation.devices_replica
     WHERE serial_number = $1 AND tenant_id = $2::uuid AND activo = true`,
    [params.topicSegment, params.tenantId],
  );
  const row = r.rows[0] as { id: string; tenant_id: string } | undefined;
  if (!row) return;

  const payload: Record<string, unknown> = {
    v: body.v,
    ts: body.ts,
    tipo: body.tipo,
    severidad: body.severidad,
    valor: body.valor,
    umbral: body.umbral,
    contexto: body.contexto ?? {},
    source: "mqtt_device",
  };

  const ev = await insertSignedEvent({
    pool: params.pool,
    deviceId: row.id,
    tipo: body.tipo,
    severidad: body.severidad,
    payload,
    signingKey: params.cfg.EVENT_SIGNING_KEY,
  });

  await publishDeviceChannel(params.redis, row.id, {
    type: "event",
    device_id: row.id,
    event: { tipo: body.tipo, severidad: body.severidad, id: ev.id },
    ts: ev.ts,
  });
}
