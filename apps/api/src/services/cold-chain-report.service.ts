import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { FastifyInstance } from "fastify";
import { ColdChainPdfDoc, type ColdChainPdfInput } from "../pdf/cold-chain-document.js";
import { listEvents, verifyEventChain } from "./events.service.js";
import { queryReadings } from "./readings.service.js";
import { sha256Buffer, signReportPayload } from "./notifications.service.js";
import { linkApiBase } from "../config.js";

export async function buildColdChainPdfBuffer(
  fastify: FastifyInstance,
  params: {
    deviceId: string;
    from: Date;
    to: Date;
    locale: "es-AR" | "en";
    reportId: string;
    tenantNombre: string;
    localNombre: string;
    deviceNombre: string;
    serial: string;
  },
): Promise<{ buffer: Buffer; pdfSha256: string; signature: string }> {
  const hourly = await queryReadings({
    pool: fastify.pgPool,
    deviceId: params.deviceId,
    from: params.from,
    to: params.to,
    interval: "1h",
  });

  const readingsHourly = hourly.map((r) => ({
    label: r.ts.slice(11, 16),
    temp: r.temp_interna,
  }));

  const raw = await queryReadings({
    pool: fastify.pgPool,
    deviceId: params.deviceId,
    from: params.from,
    to: params.to,
    interval: "raw",
  });

  const temps = raw.map((x) => x.temp_interna).filter((x): x is number => x != null && !Number.isNaN(x));
  const tempMin = temps.length ? Math.min(...temps) : null;
  const tempMax = temps.length ? Math.max(...temps) : null;
  const tempAvg =
    temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null;

  const gap = await fastify.pgPool.query(
    `WITH r AS (
       SELECT ts, lead(ts) OVER (ORDER BY ts) AS nxt
       FROM wcreation.readings
       WHERE device_id = $1::uuid AND ts >= $2::timestamptz AND ts <= $3::timestamptz
     )
     SELECT coalesce(sum(EXTRACT(EPOCH FROM (nxt - ts)) / 60.0), 0)::int AS offline_min
     FROM r
     WHERE nxt IS NOT NULL AND (nxt - ts) > interval '25 minutes'`,
    [params.deviceId, params.from.toISOString(), params.to.toISOString()],
  );
  const offlineMinutes = (gap.rows[0]?.offline_min as number) ?? 0;

  const { rows: evRows } = await listEvents({
    pool: fastify.pgPool,
    deviceId: params.deviceId,
    from: params.from,
    to: params.to,
    limit: 500,
  });

  const alertCount = evRows.filter((e) => e.severidad === "warning" || e.severidad === "critical").length;

  const events = evRows.map((e) => ({
    ts: new Date(e.ts as unknown as string).toISOString(),
    tipo: e.tipo,
    severidad: e.severidad,
    hash: e.hash_sha256,
  }));

  let primerHash: string | null = null;
  let ultimoHash = "";
  let cadenaValida = false;
  let firmaValida = false;
  if (evRows.length > 0) {
    const last = evRows[0]!;
    const v = await verifyEventChain(fastify.pgPool, params.deviceId, last.id, fastify.config.EVENT_SIGNING_KEY);
    primerHash = v.primer_hash ?? null;
    ultimoHash = v.ultimo_hash ?? "";
    cadenaValida = v.cadena_valida;
    firmaValida = v.firma_valida;
  }

  const verifyUrl = `${linkApiBase(fastify.config)}/reports/verify/${params.reportId}`;
  const emittedAt = new Date().toISOString();

  const input: ColdChainPdfInput = {
    locale: params.locale,
    tenantNombre: params.tenantNombre,
    localNombre: params.localNombre,
    deviceNombre: params.deviceNombre,
    serial: params.serial,
    periodFrom: params.from.toISOString(),
    periodTo: params.to.toISOString(),
    emittedAt,
    readingsHourly,
    tempMin,
    tempMax,
    tempAvg,
    offlineMinutes,
    alertCount,
    events,
    primerHash,
    ultimoHash,
    cadenaValida,
    firmaValida,
    verifyUrl,
    reportId: params.reportId,
  };

  const buffer = await renderToBuffer(createElement(ColdChainPdfDoc, input) as Parameters<typeof renderToBuffer>[0]);
  const pdfSha256 = sha256Buffer(buffer);
  const signature = signReportPayload(fastify.config, pdfSha256);
  return { buffer, pdfSha256, signature };
}

export function buildColdChainCsv(params: {
  deviceNombre: string;
  serial: string;
  from: Date;
  to: Date;
  events: { ts: string; tipo: string; severidad: string; hash: string }[];
  readings: { ts: string; temp_interna: number | null }[];
}): Buffer {
  const lines: string[] = [];
  lines.push(`device,${params.serial},${params.deviceNombre}`);
  lines.push(`from,${params.from.toISOString()}`);
  lines.push(`to,${params.to.toISOString()}`);
  lines.push("readings_ts,temp_interna");
  for (const r of params.readings) {
    lines.push(`${r.ts},${r.temp_interna ?? ""}`);
  }
  lines.push("event_ts,tipo,severidad,hash");
  for (const e of params.events) {
    lines.push(`${e.ts},${e.tipo},${e.severidad},${e.hash}`);
  }
  return Buffer.from(lines.join("\n"), "utf8");
}
