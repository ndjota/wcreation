import type { Pool } from "pg";
import type Redis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import type { BridgeConfig } from "../config.js";

export function startSyncWorker(params: {
  pool: Pool;
  cfg: BridgeConfig;
  log: { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void };
}): () => void {
  const tick = async () => {
    try {
      const sb = createClient(params.cfg.SUPABASE_URL, params.cfg.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: devices, error } = await sb
        .schema("wcreation")
        .from("devices")
        .select("id, serial_number, tenant_id, estado");
      if (error) throw error;
      for (const d of devices ?? []) {
        const activo = d.estado === "activo" || d.estado === "provisionado";
        await params.pool.query(
          `INSERT INTO wcreation.devices_replica (id, serial_number, tenant_id, activo, sincronizado_at)
           VALUES ($1::uuid, $2, $3::uuid, $4, now())
           ON CONFLICT (serial_number) DO UPDATE SET
             id = EXCLUDED.id,
             tenant_id = EXCLUDED.tenant_id,
             activo = EXCLUDED.activo,
             sincronizado_at = now()`,
          [d.id, d.serial_number, d.tenant_id, activo],
        );
      }
      params.log.info({ count: devices?.length ?? 0 }, "sync devices_replica");
    } catch (e) {
      params.log.error({ err: String(e) }, "sync worker");
    }
  };
  void tick();
  const id = setInterval(() => {
    void tick();
  }, 5 * 60 * 1000);
  return () => clearInterval(id);
}
