import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import type { BridgeConfig } from "../config.js";

const statusSchema = z.object({
  v: z.literal(1),
  ts: z.string(),
  estado: z.enum(["online", "offline"]),
});

export async function handleStatus(params: {
  pool: Pool;
  cfg: BridgeConfig;
  log: { warn: (o: object, m?: string) => void };
  tenantId: string;
  topicSegment: string;
  payload: unknown;
}): Promise<void> {
  const parsed = statusSchema.safeParse(params.payload);
  if (!parsed.success) {
    params.log.warn({ issues: parsed.error.flatten() }, "status inválido");
    return;
  }
  const body = parsed.data;

  const r = await params.pool.query(
    `SELECT id FROM wcreation.devices_replica
     WHERE serial_number = $1 AND tenant_id = $2::uuid`,
    [params.topicSegment, params.tenantId],
  );
  const id = r.rows[0]?.id as string | undefined;
  if (!id) return;

  const sb = createClient(params.cfg.SUPABASE_URL, params.cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.estado === "online") {
    await sb.schema("wcreation").from("devices").update({ ultimo_visto: body.ts }).eq("id", id);
  }
}
