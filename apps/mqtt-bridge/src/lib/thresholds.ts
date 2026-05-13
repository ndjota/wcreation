import { createClient } from "@supabase/supabase-js";
import { enqueueNotificationsForEvent } from "@wcreation/notify-core";
import type { Pool } from "pg";
import type { RedisConn } from "../redis-types.js";
import { insertSignedEvent } from "./signing.js";

export async function evaluateThresholds(params: {
  pool: Pool;
  redis: RedisConn;
  supabaseUrl: string;
  supabaseKey: string;
  deviceId: string;
  tenantId: string;
  reading: {
    temp_interna: number;
    temp_ambiente: number;
    bateria_pct: number;
    red_electrica: boolean;
    puerta_abierta: boolean;
    ts: string;
  };
  signingKey: string;
  log: { info: (o: object, m?: string) => void };
}): Promise<{ tipo: string; severidad: string; ts: string } | null> {
  const sb = createClient(params.supabaseUrl, params.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: th } = await sb
    .schema("wcreation")
    .from("device_thresholds")
    .select("*")
    .eq("device_id", params.deviceId)
    .maybeSingle();

  if (!th) return null;

  const breaches: { tipo: string; severidad: "warning" | "critical" }[] = [];
  const ti = params.reading.temp_interna;
  if (th.temp_interna_min != null && ti < (th.temp_interna_min as number)) {
    breaches.push({ tipo: "umbral_excedido_temp", severidad: "critical" });
  }
  if (th.temp_interna_max != null && ti > (th.temp_interna_max as number)) {
    breaches.push({ tipo: "umbral_excedido_temp", severidad: "critical" });
  }
  if (th.bateria_min_pct != null && params.reading.bateria_pct < (th.bateria_min_pct as number)) {
    breaches.push({ tipo: "bateria_baja", severidad: "warning" });
  }
  if (!params.reading.red_electrica) {
    breaches.push({ tipo: "corte_red", severidad: "critical" });
  }

  if (breaches.length === 0) return null;

  const b = breaches[0]!;
  const debKey = `wcreation:debounce:event:${params.deviceId}:${b.tipo}`;
  const ok = await params.redis.set(debKey, "1", "EX", 120, "NX");
  if (ok !== "OK") return null;

  const payload = {
    origen: "telemetry_eval",
    lectura: params.reading,
    umbral: th,
  };
  const row = await insertSignedEvent({
    pool: params.pool,
    deviceId: params.deviceId,
    tipo: b.tipo,
    severidad: b.severidad,
    payload,
    signingKey: params.signingKey,
  });

  await enqueueNotificationsForEvent(params.pool, sb, { warn: (o) => params.log.info(o) }, {
    eventoId: row.id,
    eventoTs: row.ts,
    tipo: b.tipo,
    tenantId: params.tenantId,
  });

  params.log.info({ deviceId: params.deviceId, tipo: b.tipo }, "evento interno por umbral");
  return { tipo: b.tipo, severidad: b.severidad, ts: row.ts };
}
