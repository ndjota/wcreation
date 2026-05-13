import type { FastifyInstance } from "fastify";

/** Réplica operativa en Timescale: la fuente de verdad sigue en Supabase. */
export async function syncDevicesReplicaFromSupabase(fastify: FastifyInstance): Promise<number> {
  const { data: devices, error } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("devices")
    .select("id, serial_number, tenant_id, estado");

  if (error) throw error;
  let n = 0;
  for (const d of devices ?? []) {
    const activo = d.estado === "activo" || d.estado === "provisionado";
    await fastify.pgPool.query(
      `INSERT INTO wcreation.devices_replica (id, serial_number, tenant_id, activo, sincronizado_at)
       VALUES ($1::uuid, $2, $3::uuid, $4, now())
       ON CONFLICT (serial_number) DO UPDATE SET
         id = EXCLUDED.id,
         tenant_id = EXCLUDED.tenant_id,
         activo = EXCLUDED.activo,
         sincronizado_at = now()`,
      [d.id, d.serial_number, d.tenant_id, activo],
    );
    n += 1;
  }
  return n;
}
