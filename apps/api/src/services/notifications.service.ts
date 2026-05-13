import { createHmac, createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import webpush from "web-push";
import type { FastifyInstance } from "fastify";
import { enqueueNotificationsForEvent as enqueueCore } from "@wcreation/notify-core";
import { canalesParaTipoEvento } from "@wcreation/shared";
import { reportSigningMaterialKey, type AppConfig, linkApiBase } from "../config.js";
import type { NotifyLocale, TemplateVars } from "./notification-templates.js";
import { renderNotificationTemplate } from "./notification-templates.js";

export async function enqueueNotificationsForEvent(
  fastify: FastifyInstance,
  input: { eventoId: string; eventoTs: string; tipo: string; tenantId: string },
): Promise<void> {
  await enqueueCore(fastify.pgPool, fastify.supabaseAdmin, fastify.log, input);
}

function formatDateTime(iso: string, locale: NotifyLocale): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

function valorLinea(payload: Record<string, unknown>, tipo: string, locale: NotifyLocale): string {
  const lectura = payload.lectura as Record<string, unknown> | undefined;
  const um = payload.umbral as Record<string, unknown> | undefined;
  if (tipo === "umbral_excedido_temp" && lectura && typeof lectura.temp_interna === "number") {
    const ti = lectura.temp_interna;
    const max = typeof um?.temp_interna_max === "number" ? um.temp_interna_max : "?";
    return locale === "en"
      ? `Internal temperature ${String(ti)}°C (threshold max ${String(max)}°C)`
      : `Temperatura interna ${String(ti)}°C (umbral máx. ${String(max)}°C)`;
  }
  if (tipo === "corte_red") {
    return locale === "en" ? "Mains power not detected" : "Sin tensión de red eléctrica";
  }
  if (tipo === "bateria_baja" && lectura && typeof lectura.bateria_pct === "number") {
    return locale === "en"
      ? `Battery ${String(lectura.bateria_pct)}%`
      : `Batería ${String(lectura.bateria_pct)}%`;
  }
  if (tipo === "cadena_frio_perdida") {
    return locale === "en" ? "Cold chain integrity at risk" : "Riesgo de ruptura de cadena de frío";
  }
  return locale === "en" ? "See dashboard for details" : "Consultá el panel para más detalle";
}

async function loadEventContext(
  fastify: FastifyInstance,
  eventoId: string,
  eventoTs: string,
): Promise<{
  tipo: string;
  severidad: string;
  payload: Record<string, unknown>;
  device_id: string;
  serial: string;
  device_nombre: string;
  tenant_id: string;
  group_id: string | null;
} | null> {
  const r = await fastify.pgPool.query(
    `SELECT e.tipo, e.severidad, e.payload, e.device_id,
            d.serial_number, d.nombre AS device_nombre, d.tenant_id, d.group_id
     FROM wcreation.events e
     JOIN wcreation.devices_replica d ON d.id = e.device_id
     WHERE e.id = $1::uuid AND e.ts = $2::timestamptz`,
    [eventoId, eventoTs],
  );
  const row = r.rows[0] as
    | {
        tipo: string;
        severidad: string;
        payload: Record<string, unknown>;
        device_id: string;
        serial_number: string;
        device_nombre: string;
        tenant_id: string;
        group_id: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    tipo: row.tipo,
    severidad: row.severidad,
    payload: row.payload,
    device_id: row.device_id,
    serial: row.serial_number,
    device_nombre: row.device_nombre,
    tenant_id: row.tenant_id,
    group_id: row.group_id,
  };
}

async function loadTenantGroupNames(
  fastify: FastifyInstance,
  tenantId: string,
  groupId: string | null,
): Promise<{ tenantNombre: string; localNombre: string }> {
  const { data: t } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("tenants")
    .select("razon_social")
    .eq("id", tenantId)
    .maybeSingle();
  let localNombre = "—";
  if (groupId) {
    const { data: g } = await fastify.supabaseAdmin
      .schema("wcreation")
      .from("groups")
      .select("nombre")
      .eq("id", groupId)
      .maybeSingle();
    localNombre = (g?.nombre as string) || localNombre;
  }
  return {
    tenantNombre: (t?.razon_social as string) || "WCreation",
    localNombre,
  };
}

async function buildVars(
  fastify: FastifyInstance,
  cfg: AppConfig,
  row: {
    id: string;
    evento_id: string;
    evento_ts: Date | string;
    canal: string;
    destinatario: string;
    payload: Record<string, unknown>;
    intentos: number;
  },
  locale: NotifyLocale,
): Promise<TemplateVars | null> {
  const tsIso = typeof row.evento_ts === "string" ? row.evento_ts : row.evento_ts.toISOString();
  const ctx = await loadEventContext(fastify, row.evento_id, tsIso);
  if (!ctx) return null;
  const names = await loadTenantGroupNames(fastify, ctx.tenant_id, ctx.group_id);
  const detailUrl = `${cfg.PUBLIC_APP_URL.replace(/\/$/, "")}/devices/${ctx.device_id}`;
  const verifyUrl = `${linkApiBase(cfg)}/devices/${ctx.device_id}/events/${row.evento_id}/verify`;
  return {
    deviceId: ctx.device_id,
    deviceNombre: ctx.device_nombre,
    serial: ctx.serial,
    localNombre: names.localNombre,
    tenantNombre: names.tenantNombre,
    tipo: ctx.tipo,
    severidad: ctx.severidad,
    valorLinea: valorLinea(ctx.payload, ctx.tipo, locale),
    fechaHora: formatDateTime(tsIso, locale),
    detailUrl,
    verifyUrl,
  };
}

async function sendEmail(
  fastify: FastifyInstance,
  cfg: AppConfig,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (cfg.RESEND_API_KEY) {
    const resend = new Resend(cfg.RESEND_API_KEY);
    const r = await resend.emails.send({
      from: cfg.SMTP_FROM,
      to: [to],
      subject,
      html,
    });
    if (r.error) throw new Error(r.error.message);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: false,
  });
  await transporter.sendMail({
    from: cfg.SMTP_FROM,
    to,
    subject,
    html,
  });
}

async function sendPushToUser(
  fastify: FastifyInstance,
  cfg: AppConfig,
  userId: string,
  title: string,
  body: string,
  deviceId: string,
): Promise<void> {
  if (!cfg.VAPID_PUBLIC_KEY || !cfg.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(cfg.VAPID_SUBJECT, cfg.VAPID_PUBLIC_KEY, cfg.VAPID_PRIVATE_KEY);
  const { data: subs, error } = await fastify.supabaseAdmin
    .schema("wcreation")
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_secret")
    .eq("user_id", userId);
  if (error) throw error;
  const payload = JSON.stringify({
    title,
    body,
    device_id: deviceId,
    url: `${cfg.PUBLIC_APP_URL.replace(/\/$/, "")}/devices/${deviceId}`,
  });
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint as string,
          keys: { p256dh: s.p256dh as string, auth: s.auth_secret as string },
        },
        payload,
        { TTL: 3600 },
      );
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "statusCode" in e ? (e as { statusCode: number }).statusCode : 0;
      if (status === 404 || status === 410) {
        await fastify.supabaseAdmin.schema("wcreation").from("push_subscriptions").delete().eq("endpoint", s.endpoint as string);
      } else {
        throw e;
      }
    }
  }
}

function backoffMs(intentos: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, intentos - 1));
}

type QueueRow = {
  id: string;
  evento_id: string;
  evento_ts: Date;
  canal: string;
  destinatario: string;
  payload: Record<string, unknown>;
  intentos: number;
};

async function processClaimedRow(fastify: FastifyInstance, row: QueueRow): Promise<void> {
  const cfg = fastify.config;
  const tipo = (row.payload.tipo as string) || "";
  const allowed = new Set(canalesParaTipoEvento(tipo));
  if (!allowed.has(row.canal as "email" | "push")) {
    await fastify.pgPool.query(
      `UPDATE wcreation.notifications_queue SET estado = 'enviado', enviado_en = now(), ultimo_error = null WHERE id = $1::uuid`,
      [row.id],
    );
    return;
  }

  const locale: NotifyLocale = "es-AR";
  try {
    const vars = await buildVars(fastify, cfg, row, locale);
    if (!vars) throw new Error("evento_sin_contexto");
    const tpl = renderNotificationTemplate(locale, tipo, row.canal as "email" | "push", vars);
    if (!tpl) throw new Error("sin_plantilla");

    if (row.canal === "email" && tpl.html && tpl.subject) {
      await sendEmail(fastify, cfg, row.destinatario, tpl.subject, tpl.html);
    } else if (row.canal === "push" && tpl.title && tpl.body) {
      await sendPushToUser(fastify, cfg, row.destinatario, tpl.title, tpl.body, vars.deviceId);
    }

    await fastify.pgPool.query(
      `UPDATE wcreation.notifications_queue SET estado = 'enviado', enviado_en = now(), ultimo_error = null WHERE id = $1::uuid`,
      [row.id],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const nextIntentos = (row.intentos ?? 0) + 1;
    const delayMs = backoffMs(nextIntentos);
    const nextWhen = new Date(Date.now() + delayMs).toISOString();
    if (nextIntentos >= 3) {
      await fastify.pgPool.query(
        `UPDATE wcreation.notifications_queue
         SET estado = 'dead_letter', ultimo_error = $2, intentos = $3
         WHERE id = $1::uuid`,
        [row.id, msg.slice(0, 2000), nextIntentos],
      );
    } else {
      await fastify.pgPool.query(
        `UPDATE wcreation.notifications_queue
         SET estado = 'pendiente', intentos = $2, ultimo_error = $3, programado_para = $4::timestamptz
         WHERE id = $1::uuid`,
        [row.id, nextIntentos, msg.slice(0, 2000), nextWhen],
      );
    }
  }
}

/** Procesa un lote de la cola (solo email y push; Telegram lo envía apps/telegram-bot). */
export async function dispatchNotificationBatch(fastify: FastifyInstance): Promise<void> {
  const claim = await fastify.pgPool.query(
    `WITH picked AS (
       SELECT id FROM wcreation.notifications_queue
       WHERE estado = 'pendiente' AND programado_para <= now()
         AND canal IN ('email', 'push')
       ORDER BY programado_para ASC
       LIMIT 12
       FOR UPDATE SKIP LOCKED
     )
     UPDATE wcreation.notifications_queue q
     SET estado = 'enviando'
     FROM picked p
     WHERE q.id = p.id
     RETURNING q.*`,
  );
  for (const row of claim.rows as QueueRow[]) {
    await processClaimedRow(fastify, row);
  }
}

export function startNotificationDispatcher(fastify: FastifyInstance): () => void {
  const id = setInterval(() => {
    void dispatchNotificationBatch(fastify).catch((e) => fastify.log.error(e));
  }, 5000);
  void dispatchNotificationBatch(fastify).catch((e) => fastify.log.error(e));
  return () => clearInterval(id);
}

export function signReportPayload(cfg: AppConfig, pdfSha256: string): string {
  return createHmac("sha256", reportSigningMaterialKey(cfg)).update(pdfSha256, "utf8").digest("hex");
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
