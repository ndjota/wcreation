import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import * as permissions from "../services/permissions.js";

/** KPIs agregados para el dashboard PWA (Etapa 3). */
const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/dashboard/summary",
    {
      schema: {
        description: "Métricas del dashboard según rol y alcance de dispositivos",
        tags: ["Dashboard"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;

      if (user.roleCode === "public_viewer") {
        return reply.status(403).send({ error: "forbidden" });
      }
      if (user.roleCode === "owner_admin" && !user.tenantId) {
        return reply.status(403).send({ error: "forbidden" });
      }

      const visible = await permissions.getVisibleDeviceIds(fastify, user);
      const deviceIds = visible === "all" ? null : visible;
      if (Array.isArray(deviceIds) && deviceIds.length === 0) {
        return {
          tenants_total: user.roleCode === "superadmin" ? await countTenants(fastify) : null,
          devices_total: 0,
          devices_activos: 0,
          critical_events_24h: 0,
          alert_events_24h: 0,
          cadena_frio_perdida_mes: 0,
          bateria_promedio_pct: null as number | null,
          devices_con_alerta_mv: 0,
        };
      }

      const tenantFilter =
        user.roleCode === "superadmin"
          ? { type: "none" as const }
          : user.roleCode === "owner_admin" && user.tenantId
            ? { type: "tenant" as const, tenantId: user.tenantId }
            : user.roleCode === "responsable" && Array.isArray(deviceIds)
              ? { type: "devices" as const, deviceIds }
              : { type: "none" as const };

      const [tenantsTotal, devicesTotal, devicesActivos, critical24, alert24, cadenaMes, bateriaAvg, devicesAlertMv] =
        await Promise.all([
          user.roleCode === "superadmin" ? countTenants(fastify) : Promise.resolve(null),
          countDevicesScoped(fastify, user, deviceIds, tenantFilter),
          countDevicesActivosScoped(fastify, user, deviceIds, tenantFilter),
          countEventsScoped(fastify, "critical", deviceIds, tenantFilter, 24),
          countEventsScoped(fastify, "alert", deviceIds, tenantFilter, 24),
          countCadenaFrioMesScoped(fastify, deviceIds, tenantFilter),
          avgBatteryScoped(fastify, deviceIds, tenantFilter),
          countDevicesWithMvAlertsScoped(fastify, deviceIds, tenantFilter),
        ]);

      return {
        tenants_total: tenantsTotal,
        devices_total: devicesTotal,
        devices_activos: devicesActivos,
        critical_events_24h: critical24,
        alert_events_24h: alert24,
        cadena_frio_perdida_mes: cadenaMes,
        bateria_promedio_pct: bateriaAvg,
        devices_con_alerta_mv: devicesAlertMv,
      };
    },
  );
};

async function countTenants(fastify: FastifyInstance): Promise<number> {
  const { count, error } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("tenants")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

type TenantFilter =
  | { type: "none" }
  | { type: "tenant"; tenantId: string }
  | { type: "devices"; deviceIds: string[] };

async function countDevicesScoped(
  fastify: FastifyInstance,
  user: { roleCode: string; tenantId: string | null },
  deviceIds: string[] | null,
  tf: TenantFilter,
): Promise<number> {
  if (user.roleCode === "superadmin") {
    const { count, error } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("devices")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }
  let q = fastify.supabaseAdmin.schema("wcreation").from("devices").select("id", { count: "exact", head: true });
  if (tf.type === "tenant") q = q.eq("tenant_id", tf.tenantId);
  if (tf.type === "devices") q = q.in("id", tf.deviceIds);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function countDevicesActivosScoped(
  fastify: FastifyInstance,
  user: { roleCode: string },
  deviceIds: string[] | null,
  tf: TenantFilter,
): Promise<number> {
  if (user.roleCode === "superadmin") {
    const { count, error } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("devices")
      .select("id", { count: "exact", head: true })
      .eq("estado", "activo");
    if (error) throw error;
    return count ?? 0;
  }
  let q = fastify.supabaseAdmin
    .schema("wcreation")
    .from("devices")
    .select("id", { count: "exact", head: true })
    .eq("estado", "activo");
  if (tf.type === "tenant") q = q.eq("tenant_id", tf.tenantId);
  if (tf.type === "devices") q = q.in("id", tf.deviceIds);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function countEventsScoped(
  fastify: FastifyInstance,
  kind: "critical" | "alert",
  deviceIds: string[] | null,
  tf: TenantFilter,
  hours: number,
): Promise<number> {
  const sevClause =
    kind === "critical" ? `e.severidad = 'critical'` : `e.severidad IN ('warning', 'critical')`;
  if (deviceIds === null && tf.type === "none") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.events e
       WHERE ${sevClause} AND e.ts >= NOW() - ($1::bigint * INTERVAL '1 hour')`,
      [hours],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  if (tf.type === "tenant") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.events e
       INNER JOIN wcreation.devices_replica d ON d.id = e.device_id
       WHERE ${sevClause} AND e.ts >= NOW() - ($1::bigint * INTERVAL '1 hour')
       AND d.tenant_id = $2::uuid`,
      [hours, tf.tenantId],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  if (tf.type === "devices") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.events e
       WHERE ${sevClause} AND e.ts >= NOW() - ($1::bigint * INTERVAL '1 hour')
       AND e.device_id = ANY($2::uuid[])`,
      [hours, tf.deviceIds],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  return 0;
}

async function countCadenaFrioMesScoped(
  fastify: FastifyInstance,
  deviceIds: string[] | null,
  tf: TenantFilter,
): Promise<number> {
  if (deviceIds === null && tf.type === "none") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.events e
       WHERE e.tipo = 'cadena_frio_perdida' AND e.ts >= NOW() - INTERVAL '30 days'`,
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  if (tf.type === "tenant") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.events e
       INNER JOIN wcreation.devices_replica d ON d.id = e.device_id
       WHERE e.tipo = 'cadena_frio_perdida' AND e.ts >= NOW() - INTERVAL '30 days'
       AND d.tenant_id = $1::uuid`,
      [tf.tenantId],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  if (tf.type === "devices") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.events e
       WHERE e.tipo = 'cadena_frio_perdida' AND e.ts >= NOW() - INTERVAL '30 days'
       AND e.device_id = ANY($1::uuid[])`,
      [tf.deviceIds],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  return 0;
}

async function avgBatteryScoped(
  fastify: FastifyInstance,
  deviceIds: string[] | null,
  tf: TenantFilter,
): Promise<number | null> {
  if (deviceIds === null && tf.type === "none") {
    const r = await fastify.pgPool.query(
      `SELECT ROUND(AVG(last_bateria_pct)::numeric, 1)::float AS a
       FROM wcreation.device_last_state WHERE last_bateria_pct IS NOT NULL`,
    );
    const v = r.rows[0]?.a;
    return typeof v === "number" ? v : null;
  }
  if (tf.type === "tenant") {
    const r = await fastify.pgPool.query(
      `SELECT ROUND(AVG(m.last_bateria_pct)::numeric, 1)::float AS a
       FROM wcreation.device_last_state m
       INNER JOIN wcreation.devices_replica d ON d.id = m.device_id
       WHERE m.last_bateria_pct IS NOT NULL AND d.tenant_id = $1::uuid`,
      [tf.tenantId],
    );
    const v = r.rows[0]?.a;
    return typeof v === "number" ? v : null;
  }
  if (tf.type === "devices") {
    const r = await fastify.pgPool.query(
      `SELECT ROUND(AVG(last_bateria_pct)::numeric, 1)::float AS a
       FROM wcreation.device_last_state WHERE device_id = ANY($1::uuid[])
       AND last_bateria_pct IS NOT NULL`,
      [tf.deviceIds],
    );
    const v = r.rows[0]?.a;
    return typeof v === "number" ? v : null;
  }
  return null;
}

async function countDevicesWithMvAlertsScoped(
  fastify: FastifyInstance,
  deviceIds: string[] | null,
  tf: TenantFilter,
): Promise<number> {
  const jsonNotEmpty = `m.ultimos_eventos_criticos IS NOT NULL AND m.ultimos_eventos_criticos::text <> '[]'`;
  if (deviceIds === null && tf.type === "none") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.device_last_state m WHERE ${jsonNotEmpty}`,
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  if (tf.type === "tenant") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.device_last_state m
       INNER JOIN wcreation.devices_replica d ON d.id = m.device_id
       WHERE d.tenant_id = $1::uuid AND ${jsonNotEmpty}`,
      [tf.tenantId],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  if (tf.type === "devices") {
    const r = await fastify.pgPool.query(
      `SELECT COUNT(*)::int AS c FROM wcreation.device_last_state m
       WHERE m.device_id = ANY($1::uuid[]) AND ${jsonNotEmpty}`,
      [tf.deviceIds],
    );
    return (r.rows[0]?.c as number) ?? 0;
  }
  return 0;
}

export default dashboardRoutes;
