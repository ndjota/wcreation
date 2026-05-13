import type { FastifyInstance } from "fastify";

/** Una fila en `devices_replica` (misma lógica que el worker del bridge). */
export async function upsertSingleDeviceReplica(
  fastify: FastifyInstance,
  device: { id: string; serial_number: string; tenant_id: string; estado: string },
): Promise<void> {
  const activo = device.estado === "activo" || device.estado === "provisionado";
  await fastify.pgPool.query(
    `INSERT INTO wcreation.devices_replica (id, serial_number, tenant_id, activo, sincronizado_at)
     VALUES ($1::uuid, $2, $3::uuid, $4, now())
     ON CONFLICT (serial_number) DO UPDATE SET
       id = EXCLUDED.id,
       tenant_id = EXCLUDED.tenant_id,
       activo = EXCLUDED.activo,
       sincronizado_at = now()`,
    [device.id, device.serial_number, device.tenant_id, activo],
  );
}

/** Réplica operativa en Timescale: la fuente de verdad sigue en Supabase. */
export async function syncDevicesReplicaFromSupabase(fastify: FastifyInstance): Promise<number> {
  const { data: devices, error } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("devices")
    .select("id, serial_number, tenant_id, estado");

  if (error) throw error;
  let n = 0;
  for (const d of devices ?? []) {
    await upsertSingleDeviceReplica(fastify, {
      id: d.id as string,
      serial_number: d.serial_number as string,
      tenant_id: d.tenant_id as string,
      estado: d.estado as string,
    });
    n += 1;
  }
  return n;
}
