import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { buildColdChainPdfBuffer } from "../services/cold-chain-report.service.js";
import { linkApiBase } from "../config.js";

function estadoPublicoFromMv(ultimosCrit: unknown): "ok" | "alerta" | "critico" {
  if (!Array.isArray(ultimosCrit) || ultimosCrit.length === 0) return "ok";
  const tipos = ultimosCrit.map((e: { severidad?: string }) => e.severidad);
  if (tipos.includes("critical")) return "critico";
  if (tipos.includes("warning")) return "alerta";
  return "ok";
}

async function resolveQrRow(fastify: FastifyInstance, token: string) {
  const { data: row, error } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("public_qr_tokens")
    .select("device_id, group_id, activo, devices(nombre), groups(nombre)")
    .eq("token_publico", token)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw error;
  return row;
}

async function resolvePublicQrFull(fastify: FastifyInstance, token: string) {
  const row = await resolveQrRow(fastify, token);
  if (!row) return null;

  const deviceIds: string[] = [];
  let nombreLocal = "Local";

  if (row.device_id) {
    deviceIds.push(row.device_id as string);
    const d = row.devices as { nombre?: string } | null;
    nombreLocal = d?.nombre ?? nombreLocal;
  } else if (row.group_id) {
    const { data: devs } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("devices")
      .select("id")
      .eq("group_id", row.group_id as string);
    for (const d of devs ?? []) deviceIds.push(d.id as string);
    const g = row.groups as { nombre?: string } | null;
    nombreLocal = g?.nombre ?? nombreLocal;
  }

  let estado: "ok" | "alerta" | "critico" = "ok";
  let ultimaVerificacion: string | null = null;

  for (const id of deviceIds) {
    const mv = await fastify.pgPool.query(
      `SELECT last_reading_ts, ultimos_eventos_criticos FROM wcreation.device_last_state WHERE device_id = $1`,
      [id],
    );
    const r = mv.rows[0];
    if (r?.last_reading_ts) {
      const ts = new Date(r.last_reading_ts as string).toISOString();
      if (!ultimaVerificacion || ts > ultimaVerificacion) ultimaVerificacion = ts;
    }
    const e = estadoPublicoFromMv(r?.ultimos_eventos_criticos);
    if (e === "critico") estado = "critico";
    else if (e === "alerta" && estado !== "critico") estado = "alerta";
  }

  const primaryDevice = deviceIds[0];
  let chart24h: { bucket: string; in_range: boolean }[] = [];
  let tempMin: number | null = null;
  let tempMax: number | null = null;

  if (primaryDevice) {
    const th = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("device_thresholds")
      .select("temp_interna_min, temp_interna_max")
      .eq("device_id", primaryDevice)
      .maybeSingle();
    const tmin = th.data?.temp_interna_min as number | null | undefined;
    const tmax = th.data?.temp_interna_max as number | null | undefined;
    tempMin = tmin ?? null;
    tempMax = tmax ?? null;

    const buck = await fastify.pgPool.query(
      `SELECT time_bucket('1 hour', ts) AS b, avg(temp_interna)::real AS ti
       FROM wcreation.readings
       WHERE device_id = $1::uuid AND ts >= now() - interval '24 hours'
       GROUP BY 1 ORDER BY 1 ASC`,
      [primaryDevice],
    );
    chart24h = buck.rows.map((r) => {
      const ti = r.ti as number | null;
      const inRange =
        ti == null
          ? true
          : (tmin == null || ti >= tmin) && (tmax == null || ti <= tmax);
      return { bucket: new Date(r.b as string).toISOString(), in_range: inRange };
    });
  }

  const eventsPublic: { at: string; kind: "verificacion_ok" | "incidente_reportado" }[] = [];
  if (deviceIds.length > 0) {
    const ev = await fastify.pgPool.query(
      `SELECT ts, severidad FROM wcreation.events
       WHERE device_id = ANY($1::uuid[]) AND ts >= now() - interval '30 days'
       ORDER BY ts DESC LIMIT 80`,
      [deviceIds],
    );
    for (const e of ev.rows as { ts: Date; severidad: string }[]) {
      const kind =
        e.severidad === "critical" || e.severidad === "warning" ? "incidente_reportado" : "verificacion_ok";
      eventsPublic.push({ at: new Date(e.ts).toISOString(), kind });
    }
  }

  return {
    nombre_local: nombreLocal,
    estado,
    ultima_verificacion: ultimaVerificacion,
    chart_24h: chart24h,
    thresholds: { temp_interna_min: tempMin, temp_interna_max: tempMax },
    events_public: eventsPublic,
    _device_ids: deviceIds,
  };
}

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/public/qr/:token",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        description: "Estado agregado y vista pública ampliada (token QR)",
        tags: ["Público"],
      },
    },
    async (request, reply) => {
      const token = z.string().min(8).max(200).parse((request.params as { token: string }).token);
      const data = await resolvePublicQrFull(fastify, token);
      if (!data) return reply.status(404).send({ error: "token_invalido" });
      const { _device_ids, ...rest } = data;
      void _device_ids;
      return rest;
    },
  );

  fastify.post(
    "/public/qr/:token/reports/cold-chain",
    {
      config: { rateLimit: { max: 6, timeWindow: "1 hour" } },
      schema: {
        description: "Genera PDF de cadena de frío para el período actual (7 días), acceso público vía QR",
        tags: ["Público"],
      },
    },
    async (request, reply) => {
      const token = z.string().min(8).max(200).parse((request.params as { token: string }).token);
      const full = await resolvePublicQrFull(fastify, token);
      if (!full || full._device_ids.length === 0) return reply.status(404).send({ error: "token_invalido" });
      const deviceId = full._device_ids[0]!;
      const from = new Date(Date.now() - 7 * 86400000);
      const to = new Date();

      const { data: dev, error: dErr } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select("id, nombre, serial_number, tenant_id, group_id")
        .eq("id", deviceId)
        .maybeSingle();
      if (dErr) throw dErr;
      if (!dev) return reply.status(404).send({ error: "not_found" });

      const { data: tenant } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("tenants")
        .select("razon_social")
        .eq("id", dev.tenant_id as string)
        .maybeSingle();

      let localNombre = "—";
      if (dev.group_id) {
        const { data: g } = await fastify.supabaseAdmin
          .schema("wcreation")
          .from("groups")
          .select("nombre")
          .eq("id", dev.group_id as string)
          .maybeSingle();
        localNombre = (g?.nombre as string) || localNombre;
      }

      const reportId = randomUUID();
        const { buffer, pdfSha256, signature } = await buildColdChainPdfBuffer(fastify, {
          deviceId,
          from,
          to,
          locale: "es-AR",
          reportId,
          tenantNombre: (tenant?.razon_social as string) || "—",
          localNombre,
          deviceNombre: dev.nombre as string,
          serial: dev.serial_number as string,
        });

      const path = `${dev.tenant_id as string}/${reportId}.pdf`;
      const { error: upErr } = await fastify.supabaseAdmin.storage
        .from("cold-chain-reports")
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { error: repErr } = await fastify.supabaseAdmin.schema("wcreation").from("cold_chain_reports").insert({
        id: reportId,
        device_id: deviceId,
        tenant_id: dev.tenant_id as string,
        period_from: from.toISOString(),
        period_to: to.toISOString(),
        format: "pdf",
        storage_path: path,
        pdf_sha256: pdfSha256,
        report_signature: signature,
        created_by_user_id: null,
        is_public_qr: true,
      });
      if (repErr) throw repErr;

      const { data: signed, error: sErr } = await fastify.supabaseAdmin.storage
        .from("cold-chain-reports")
        .createSignedUrl(path, 3600);
      if (sErr) throw sErr;

      return {
        report_id: reportId,
        download_url: signed.signedUrl,
        verify_url: `${linkApiBase(fastify.config)}/reports/verify/${reportId}`,
      };
    },
  );

  fastify.get(
    "/public/qr/:token/badge.svg",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        description: "Badge SVG del estado público",
        tags: ["Público"],
      },
    },
    async (request, reply) => {
      const token = z.string().min(8).max(200).parse((request.params as { token: string }).token);
      const data = await resolvePublicQrFull(fastify, token);
      const estado = data?.estado ?? "ok";
      const color = estado === "critico" ? "#b91c1c" : estado === "alerta" ? "#ca8a04" : "#15803d";
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32">
  <rect width="120" height="32" rx="6" fill="${color}"/>
  <text x="60" y="21" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="12">WCreation</text>
</svg>`;
      return reply.type("image/svg+xml").send(svg);
    },
  );

  fastify.get(
    "/reports/verify/:report_id",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        description: "Verificación pública de metadatos de un reporte emitido",
        tags: ["Público"],
      },
    },
    async (request, reply) => {
      const reportId = z.string().uuid().parse((request.params as { report_id: string }).report_id);
      const { data: rep, error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("cold_chain_reports")
        .select("id, created_at, period_from, period_to, format, pdf_sha256, report_signature, device_id, tenant_id")
        .eq("id", reportId)
        .maybeSingle();
      if (error) throw error;
      if (!rep) return reply.status(404).send({ error: "not_found" });

      const { data: dev } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select("nombre, serial_number")
        .eq("id", rep.device_id as string)
        .maybeSingle();
      const { data: ten } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("tenants")
        .select("razon_social")
        .eq("id", rep.tenant_id as string)
        .maybeSingle();

      return {
        report_id: rep.id as string,
        emitido_en: rep.created_at as string,
        period_from: rep.period_from as string,
        period_to: rep.period_to as string,
        formato: rep.format as string,
        pdf_sha256: rep.pdf_sha256 as string,
        report_signature: rep.report_signature as string,
        dispositivo_nombre: dev?.nombre ?? null,
        dispositivo_serial: dev?.serial_number ?? null,
        tenant_razon_social: ten?.razon_social ?? null,
        emitido_por_sistema: true,
      };
    },
  );
};

export default publicRoutes;
