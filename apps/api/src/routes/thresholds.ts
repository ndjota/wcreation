import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as permissions from "../services/permissions.js";
import { getLastEventHash, signServerEvent } from "../services/events.service.js";
import { enqueueNotificationsForEvent } from "../services/notifications.service.js";

const params = z.object({ id: z.string().uuid() });

const thresholdsBody = z.object({
  temp_interna_min: z.number().nullable().optional(),
  temp_interna_max: z.number().nullable().optional(),
  temp_ambiente_min: z.number().nullable().optional(),
  temp_ambiente_max: z.number().nullable().optional(),
  bateria_min_pct: z.number().int().min(0).max(100).nullable().optional(),
  corte_red_max_seg: z.number().int().min(0).nullable().optional(),
  puerta_abierta_max_seg: z.number().int().min(0).nullable().optional(),
  modificable_por_responsable: z.boolean().optional(),
});

const thresholdsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.put(
    "/devices/:id/thresholds",
    {
      schema: {
        description: "Actualiza umbrales (permisos según rol y flag responsable)",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const { id } = params.parse(request.params);
      const body = thresholdsBody.parse(request.body);

      const { data: th, error: e1 } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("device_thresholds")
        .select("*")
        .eq("device_id", id)
        .maybeSingle();

      if (e1) throw e1;
      const modificable = (th?.modificable_por_responsable as boolean | undefined) ?? false;

      if (!(await permissions.canConfigureThresholds(fastify, user, id, modificable))) {
        return reply.status(403).send({ error: "forbidden" });
      }

      const { data: device, error: e2 } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select("tenant_id")
        .eq("id", id)
        .maybeSingle();
      if (e2) throw e2;
      if (!device) return reply.status(404).send({ error: "device_not_found" });

      const merged = {
        device_id: id,
        temp_interna_min: body.temp_interna_min ?? th?.temp_interna_min ?? null,
        temp_interna_max: body.temp_interna_max ?? th?.temp_interna_max ?? null,
        temp_ambiente_min: body.temp_ambiente_min ?? th?.temp_ambiente_min ?? null,
        temp_ambiente_max: body.temp_ambiente_max ?? th?.temp_ambiente_max ?? null,
        bateria_min_pct: body.bateria_min_pct ?? th?.bateria_min_pct ?? null,
        corte_red_max_seg: body.corte_red_max_seg ?? th?.corte_red_max_seg ?? null,
        puerta_abierta_max_seg: body.puerta_abierta_max_seg ?? th?.puerta_abierta_max_seg ?? null,
        modificable_por_responsable:
          body.modificable_por_responsable ?? th?.modificable_por_responsable ?? false,
      };

      const { error: e3 } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("device_thresholds")
        .upsert(merged, { onConflict: "device_id" });

      if (e3) throw e3;

      const tsIso = new Date().toISOString();
      const payload = {
        accion: "thresholds_updated",
        usuario_id: user.id,
        cambios: body,
      };
      const hashAnterior = await getLastEventHash(fastify.pgPool, id);
      const hash = signServerEvent({
        payload,
        tsIso,
        deviceId: id,
        hashAnterior,
        signingKey: fastify.config.EVENT_SIGNING_KEY,
      });

      const ins = await fastify.pgPool.query(
        `INSERT INTO wcreation.events (ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior)
         VALUES ($1::timestamptz, $2::uuid, 'configuracion_modificada', 'info', $3::jsonb, $4, $5)
         RETURNING id, ts`,
        [tsIso, id, JSON.stringify(payload), hash, hashAnterior],
      );
      const row = ins.rows[0] as { id: string; ts: Date };

      await enqueueNotificationsForEvent(fastify, {
        eventoId: row.id,
        eventoTs: row.ts.toISOString(),
        tipo: "configuracion_modificada",
        tenantId: device.tenant_id as string,
      });

      await fastify.redis.publish(
        `wcreation:device:${id}`,
        JSON.stringify({
          type: "event",
          device_id: id,
          event: { tipo: "configuracion_modificada", severidad: "info", payload },
          ts: tsIso,
        }),
      );

      return { ok: true, event_id: row.id };
    },
  );
};

export default thresholdsRoutes;
