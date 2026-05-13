import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as permissions from "../services/permissions.js";

const listQuery = z.object({
  group_id: z.string().uuid().optional(),
  estado: z.enum(["provisionado", "activo", "inactivo", "baja"]).optional(),
  search: z.string().max(200).optional(),
});

const deviceParams = z.object({
  id: z.string().uuid(),
});

const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/devices",
    {
      schema: {
        description: "Lista dispositivos visibles según rol y asignaciones",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            group_id: { type: "string", format: "uuid" },
            estado: { type: "string" },
            search: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const user = request.authUser!;
      const q = listQuery.parse(request.query);

      let query = fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select(
          "id, tenant_id, group_id, serial_number, nombre, estado, ultimo_visto, ubicacion_lat, ubicacion_lng, ubicacion_descripcion",
        );

      if (user.roleCode === "owner_admin" && user.tenantId) {
        query = query.eq("tenant_id", user.tenantId);
      } else if (user.roleCode === "responsable") {
        const visible = await permissions.getVisibleDeviceIds(fastify, user);
        if (Array.isArray(visible) && visible.length === 0) return { items: [] };
        if (Array.isArray(visible)) query = query.in("id", visible);
      } else if (user.roleCode !== "superadmin") {
        return { items: [] };
      }

      if (q.group_id) query = query.eq("group_id", q.group_id);
      if (q.estado) query = query.eq("estado", q.estado);

      const { data: rows, error } = await query;
      if (error) throw error;
      let devices = rows ?? [];
      if (q.search) {
        const s = q.search.toLowerCase();
        devices = devices.filter(
          (d) =>
            String(d.nombre).toLowerCase().includes(s) || String(d.serial_number).toLowerCase().includes(s),
        );
      }
      const ids = devices.map((d) => d.id as string);
      const thMap: Record<string, Record<string, unknown>> = {};
      if (ids.length > 0) {
        const { data: thRows } = await fastify.supabaseAdmin
          .schema("wcreation")
          .from("device_thresholds")
          .select("*")
          .in("device_id", ids);
        for (const t of thRows ?? []) thMap[t.device_id as string] = t as Record<string, unknown>;
      }

      let mvRows: Record<string, Record<string, unknown>> = {};
      if (ids.length > 0) {
        const mv = await fastify.pgPool.query(
          `SELECT device_id, last_reading_ts, ultimos_eventos_criticos
           FROM wcreation.device_last_state WHERE device_id = ANY($1::uuid[])`,
          [ids],
        );
        mvRows = Object.fromEntries(mv.rows.map((r) => [r.device_id as string, r as Record<string, unknown>]));
      }

      const items = await Promise.all(
        devices.map(async (d) => {
          const id = d.id as string;
          const raw = await fastify.redis.get(`wcreation:device:${id}:last`);
          let lastRedis: Record<string, unknown> | null = null;
          try {
            lastRedis = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
          } catch {
            lastRedis = null;
          }
          const mv = mvRows[id];
          return {
            id,
            tenant_id: d.tenant_id,
            group_id: d.group_id,
            serial_number: d.serial_number,
            nombre: d.nombre,
            estado: d.estado,
            ultimo_visto: d.ultimo_visto,
            ubicacion: {
              lat: d.ubicacion_lat,
              lng: d.ubicacion_lng,
              descripcion: d.ubicacion_descripcion,
            },
            thresholds: thMap[id] ?? null,
            ultimo_estado_redis: lastRedis,
            vista_vps: mv
              ? {
                  last_reading_ts: mv.last_reading_ts,
                  ultimos_eventos_criticos: mv.ultimos_eventos_criticos,
                }
              : null,
          };
        }),
      );

      return { items };
    },
  );

  fastify.get(
    "/devices/:id",
    {
      schema: {
        description: "Detalle de dispositivo",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const { id } = deviceParams.parse(request.params);
      if (!(await permissions.canViewDevice(fastify, user, id))) {
        return reply.status(403).send({ error: "forbidden" });
      }

      const { data: d, error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select(
          "id, tenant_id, group_id, serial_number, nombre, estado, ultimo_visto, ubicacion_lat, ubicacion_lng, ubicacion_descripcion",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!d) return reply.status(404).send({ error: "not_found" });

      const { data: th } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("device_thresholds")
        .select("*")
        .eq("device_id", id)
        .maybeSingle();

      const cert = await fastify.pgPool.query(
        `SELECT fingerprint, common_name, emitido_en, expira_en, revocado_en
         FROM wcreation.device_certificates WHERE device_id = $1 ORDER BY emitido_en DESC LIMIT 1`,
        [id],
      );

      const raw = await fastify.redis.get(`wcreation:device:${id}:last`);
      let lastRedis: Record<string, unknown> | null = null;
      try {
        lastRedis = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        lastRedis = null;
      }

      return {
        ...d,
        device_thresholds: th,
        ubicacion: {
          lat: d.ubicacion_lat,
          lng: d.ubicacion_lng,
          descripcion: d.ubicacion_descripcion,
        },
        ultimo_estado_redis: lastRedis,
        certificado: cert.rows[0] ?? null,
      };
    },
  );

  fastify.get(
    "/devices/:id/qr",
    {
      schema: {
        description: "Genera o recupera QR público del dispositivo",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const { id } = deviceParams.parse(request.params);
      if (!(await permissions.canManageDeviceQr(fastify, user, id))) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const { data: d, error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select("id, nombre, tenant_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!d) return reply.status(404).send({ error: "not_found" });

      const { data: existing } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("public_qr_tokens")
        .select("token_publico")
        .eq("device_id", id)
        .eq("activo", true)
        .maybeSingle();

      let token = existing?.token_publico as string | undefined;
      if (!token) {
        const { randomBytes } = await import("node:crypto");
        token = randomBytes(22).toString("base64url");
        const { error: insErr } = await fastify.supabaseAdmin.schema("wcreation").from("public_qr_tokens").insert({
          device_id: id,
          token_publico: token,
          activo: true,
        });
        if (insErr) throw insErr;
      }

      const base = fastify.config.PUBLIC_APP_URL.replace(/\/$/, "");
      const url_publica = `${base}/qr/${encodeURIComponent(token)}`;
      const label = `wcreation.ndjota.io/qr/${token.slice(0, 10)}`;
      const { buildQrAssets } = await import("../services/device-qr.service.js");
      const assets = await buildQrAssets({ fullUrl: url_publica, labelHostPath: label });

      return {
        token,
        url_publica,
        qr_svg_large: assets.qr_svg_large,
        qr_svg_small: assets.qr_svg_small,
        qr_png_large_base64: assets.qr_png_large_base64,
        qr_png_small_base64: assets.qr_png_small_base64,
      };
    },
  );

  fastify.post(
    "/devices/:id/qr/rotate",
    {
      schema: {
        description: "Rota el token QR público del dispositivo",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const { id } = deviceParams.parse(request.params);
      if (!(await permissions.canManageDeviceQr(fastify, user, id))) {
        return reply.status(403).send({ error: "forbidden" });
      }
      await fastify.supabaseAdmin
        .schema("wcreation")
        .from("public_qr_tokens")
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq("device_id", id)
        .eq("activo", true);

      const { randomBytes } = await import("node:crypto");
      const token = randomBytes(22).toString("base64url");
      const { error: insErr } = await fastify.supabaseAdmin.schema("wcreation").from("public_qr_tokens").insert({
        device_id: id,
        token_publico: token,
        activo: true,
      });
      if (insErr) throw insErr;

      const base = fastify.config.PUBLIC_APP_URL.replace(/\/$/, "");
      const url_publica = `${base}/qr/${encodeURIComponent(token)}`;
      const label = `wcreation.ndjota.io/qr/${token.slice(0, 10)}`;
      const { buildQrAssets } = await import("../services/device-qr.service.js");
      const assets = await buildQrAssets({ fullUrl: url_publica, labelHostPath: label });

      return {
        token,
        url_publica,
        qr_svg_large: assets.qr_svg_large,
        qr_svg_small: assets.qr_svg_small,
        qr_png_large_base64: assets.qr_png_large_base64,
        qr_png_small_base64: assets.qr_png_small_base64,
      };
    },
  );
};

export default deviceRoutes;
