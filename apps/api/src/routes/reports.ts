import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as permissions from "../services/permissions.js";
import { buildColdChainPdfBuffer, buildColdChainCsv } from "../services/cold-chain-report.service.js";
import { listEvents } from "../services/events.service.js";
import { queryReadings } from "../services/readings.service.js";
import { sha256Buffer, signReportPayload } from "../services/notifications.service.js";
import { linkApiBase } from "../config.js";
import { randomUUID } from "node:crypto";

const bodySchema = z.object({
  device_id: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  format: z.enum(["pdf", "csv"]),
  locale: z.enum(["es-AR", "en"]).optional(),
});

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/reports/cold-chain",
    {
      schema: {
        description: "Genera reporte de cadena de frío (PDF o CSV) y lo almacena",
        tags: ["Reportes"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const body = bodySchema.parse(request.body);
      const from = new Date(body.from);
      const to = new Date(body.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
        return reply.status(400).send({ error: "invalid_range" });
      }
      if (!(await permissions.canViewDevice(fastify, user, body.device_id))) {
        return reply.status(403).send({ error: "forbidden" });
      }

      const { data: dev, error: dErr } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("devices")
        .select("id, nombre, serial_number, tenant_id, group_id")
        .eq("id", body.device_id)
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
      const locale = body.locale ?? "es-AR";
      const tenantNombre = (tenant?.razon_social as string) || "—";
      const deviceNombre = dev.nombre as string;
      const serial = dev.serial_number as string;

      const path = `${dev.tenant_id as string}/${reportId}.${body.format === "pdf" ? "pdf" : "csv"}`;

      if (body.format === "pdf") {
        const { buffer, pdfSha256, signature } = await buildColdChainPdfBuffer(fastify, {
          deviceId: body.device_id,
          from,
          to,
          locale,
          reportId,
          tenantNombre,
          localNombre,
          deviceNombre,
          serial,
        });

        const { error: upErr } = await fastify.supabaseAdmin.storage
          .from("cold-chain-reports")
          .upload(path, buffer, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;

        const { error: repErr } = await fastify.supabaseAdmin.schema("wcreation").from("cold_chain_reports").insert({
          id: reportId,
          device_id: body.device_id,
          tenant_id: dev.tenant_id as string,
          period_from: from.toISOString(),
          period_to: to.toISOString(),
          format: "pdf",
          storage_path: path,
          pdf_sha256: pdfSha256,
          report_signature: signature,
          created_by_user_id: user.id,
          is_public_qr: false,
        });
        if (repErr) throw repErr;
      } else {
        const { rows: evRows } = await listEvents({
          pool: fastify.pgPool,
          deviceId: body.device_id,
          from,
          to,
          limit: 2000,
        });
        const raw = await queryReadings({
          pool: fastify.pgPool,
          deviceId: body.device_id,
          from,
          to,
          interval: "raw",
        });
        const csvBuf = buildColdChainCsv({
          deviceNombre,
          serial,
          from,
          to,
          events: evRows.map((e) => ({
            ts: new Date(e.ts as unknown as string).toISOString(),
            tipo: e.tipo,
            severidad: e.severidad,
            hash: e.hash_sha256,
          })),
          readings: raw.map((r) => ({ ts: r.ts, temp_interna: r.temp_interna })),
        });
        const { error: upErr } = await fastify.supabaseAdmin.storage
          .from("cold-chain-reports")
          .upload(path, csvBuf, { contentType: "text/csv", upsert: true });
        if (upErr) throw upErr;
        const pdfSha256 = sha256Buffer(csvBuf);
        const signature = signReportPayload(fastify.config, pdfSha256);
        const { error: repErr } = await fastify.supabaseAdmin.schema("wcreation").from("cold_chain_reports").insert({
          id: reportId,
          device_id: body.device_id,
          tenant_id: dev.tenant_id as string,
          period_from: from.toISOString(),
          period_to: to.toISOString(),
          format: "csv",
          storage_path: path,
          pdf_sha256: pdfSha256,
          report_signature: signature,
          created_by_user_id: user.id,
          is_public_qr: false,
        });
        if (repErr) throw repErr;
      }

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
};

export default reportsRoutes;
