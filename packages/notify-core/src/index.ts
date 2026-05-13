import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import { canalesParaTipoEvento } from "@wcreation/shared";

export interface EnqueueLog {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

/**
 * Encola notificaciones según preferencias del usuario, con filtro por tenant,
 * canales permitidos por tipo de evento e idempotencia vía UNIQUE en VPS.
 */
export async function enqueueNotificationsForEvent(
  pool: Pool,
  supabase: SupabaseClient,
  log: EnqueueLog,
  input: {
    eventoId: string;
    eventoTs: string;
    tipo: string;
    tenantId: string;
  },
): Promise<void> {
  const allowedCanales = new Set(canalesParaTipoEvento(input.tipo));
  if (allowedCanales.size === 0) return;

  const { data: prefs, error } = await supabase
    .schema("wcreation")
    .from("notification_preferences")
    .select("user_id, canal, evento_tipo, habilitado, telegram_chat_id")
    .eq("habilitado", true)
    .eq("evento_tipo", input.tipo);

  if (error) {
    log.warn({ error: error.message }, "enqueueNotificationsForEvent prefs");
    return;
  }

  for (const p of prefs ?? []) {
    const canal = p.canal as string;
    if (canal !== "email" && canal !== "push" && canal !== "telegram") continue;
    if (!allowedCanales.has(canal)) continue;

    const { data: u, error: uErr } = await supabase
      .schema("wcreation")
      .from("users")
      .select("email, tenant_id, role_code, telegram_chat_id, notifications_paused")
      .eq("id", p.user_id as string)
      .maybeSingle();

    if (uErr || !u) continue;
    if (u.notifications_paused === true) continue;
    if (u.role_code !== "superadmin" && u.tenant_id !== input.tenantId) continue;

    let destinatario = "";
    if (canal === "telegram") {
      destinatario = ((p.telegram_chat_id as string) || (u.telegram_chat_id as string) || "").trim();
    } else if (canal === "email") {
      destinatario = (u.email as string) || "";
    } else if (canal === "push") {
      destinatario = p.user_id as string;
    }
    if (!destinatario) continue;

    try {
      await pool.query(
        `INSERT INTO wcreation.notifications_queue
          (evento_id, evento_ts, canal, destinatario, payload, estado, intentos, programado_para)
         VALUES ($1::uuid, $2::timestamptz, $3, $4, $5::jsonb, 'pendiente', 0, now())
         ON CONFLICT (evento_id, evento_ts, canal, destinatario) DO NOTHING`,
        [
          input.eventoId,
          input.eventoTs,
          canal,
          destinatario,
          JSON.stringify({ tipo: input.tipo, tenant_id: input.tenantId }),
        ],
      );
    } catch (e) {
      log.warn({ err: String(e), eventoId: input.eventoId, canal }, "enqueueNotificationsForEvent insert");
    }
  }
}
