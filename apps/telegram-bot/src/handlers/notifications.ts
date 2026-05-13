import type { Telegraf } from "telegraf";
import { Markup } from "telegraf";
import type { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";

function linkApiBase(cfg: BotConfig): string {
  return (cfg.APP_LINK_API_URL ?? cfg.PUBLIC_APP_URL).replace(/\/$/, "");
}

function backoffMs(intentos: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, intentos - 1));
}

async function loadEventLine(
  pool: Pool,
  eventoId: string,
  eventoTs: string,
): Promise<{
  tipo: string;
  severidad: string;
  device_id: string;
  serial: string;
  nombre: string;
  group_id: string | null;
  tenant_id: string;
  payload: Record<string, unknown>;
} | null> {
  const r = await pool.query(
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
    device_id: row.device_id,
    serial: row.serial_number,
    nombre: row.device_nombre,
    group_id: row.group_id,
    tenant_id: row.tenant_id,
    payload: row.payload,
  };
}

function valorLinea(payload: Record<string, unknown>, tipo: string): string {
  const lectura = payload.lectura as Record<string, unknown> | undefined;
  const um = payload.umbral as Record<string, unknown> | undefined;
  if (tipo === "umbral_excedido_temp" && lectura && typeof lectura.temp_interna === "number") {
    const max = um?.temp_interna_max;
    return `Valor: ${String(lectura.temp_interna)}°C (umbral máx. ${String(max ?? "?")}°C)`;
  }
  if (tipo === "corte_red") return "Corte de red eléctrica";
  if (tipo === "cadena_frio_perdida") return "Revisión de cadena de frío requerida";
  return "Ver detalle en WCreation";
}

export function startTelegramNotificationWorker(params: {
  bot: Telegraf;
  pool: Pool;
  cfg: BotConfig;
  sb: SupabaseClient;
}): () => void {
  const tick = async () => {
    const claim = await params.pool.query(
      `WITH picked AS (
         SELECT id FROM wcreation.notifications_queue
         WHERE estado = 'pendiente' AND programado_para <= now() AND canal = 'telegram'
         ORDER BY programado_para ASC
         LIMIT 15
         FOR UPDATE SKIP LOCKED
       )
       UPDATE wcreation.notifications_queue q
       SET estado = 'enviando'
       FROM picked p
       WHERE q.id = p.id
       RETURNING q.*`,
    );

    for (const row of claim.rows as {
      id: string;
      evento_id: string;
      evento_ts: Date;
      destinatario: string;
      payload: Record<string, unknown>;
      intentos: number;
    }[]) {
      const { data: usr } = await params.sb
        .schema("wcreation")
        .from("users")
        .select("notifications_paused")
        .eq("telegram_chat_id", row.destinatario)
        .maybeSingle();
      if (usr?.notifications_paused) {
        await params.pool.query(
          `UPDATE wcreation.notifications_queue SET estado = 'enviado', enviado_en = now(), ultimo_error = 'paused' WHERE id = $1::uuid`,
          [row.id],
        );
        continue;
      }

      try {
        const tsIso = row.evento_ts instanceof Date ? row.evento_ts.toISOString() : String(row.evento_ts);
        const ev = await loadEventLine(params.pool, row.evento_id, tsIso);
        if (!ev) throw new Error("evento_no_encontrado");

        let localNombre = "—";
        if (ev.group_id) {
          const { data: g } = await params.sb
            .schema("wcreation")
            .from("groups")
            .select("nombre")
            .eq("id", ev.group_id)
            .maybeSingle();
          localNombre = (g?.nombre as string) || localNombre;
        }

        const base = params.cfg.PUBLIC_APP_URL.replace(/\/$/, "");
        const detailUrl = `${base}/devices/${ev.device_id}`;
        const verifyUrl = `${linkApiBase(params.cfg)}/devices/${ev.device_id}/events/${row.evento_id}/verify`;
        const hora = new Date(tsIso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
        const crit = ev.severidad === "critical" || ev.tipo === "cadena_frio_perdida";
        const header = crit ? "🔴 Alerta crítica · Cadena de frío" : "🟡 Alerta WCreation";
        const text = [
          header,
          `Dispositivo: ${ev.nombre} (${ev.serial})`,
          `Local: ${localNombre}`,
          `Evento: ${ev.tipo.replace(/_/g, " ")}`,
          valorLinea(ev.payload, ev.tipo),
          `Hora: ${hora}`,
        ].join("\n");

        await params.bot.telegram.sendMessage(row.destinatario, text, {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.url("Ver detalle", detailUrl), Markup.button.url("Verificar firma", verifyUrl)],
          ]).reply_markup,
        });

        await params.pool.query(
          `UPDATE wcreation.notifications_queue SET estado = 'enviado', enviado_en = now(), ultimo_error = null WHERE id = $1::uuid`,
          [row.id],
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const nextIntentos = (row.intentos ?? 0) + 1;
        const nextWhen = new Date(Date.now() + backoffMs(nextIntentos)).toISOString();
        if (nextIntentos >= 3) {
          await params.pool.query(
            `UPDATE wcreation.notifications_queue SET estado = 'dead_letter', ultimo_error = $2, intentos = $3 WHERE id = $1::uuid`,
            [row.id, msg.slice(0, 2000), nextIntentos],
          );
        } else {
          await params.pool.query(
            `UPDATE wcreation.notifications_queue SET estado = 'pendiente', intentos = $2, ultimo_error = $3, programado_para = $4::timestamptz WHERE id = $1::uuid`,
            [row.id, nextIntentos, msg.slice(0, 2000), nextWhen],
          );
        }
      }
    }
  };

  const id = setInterval(() => {
    void tick().catch((e) => console.error(e));
  }, 5000);
  void tick().catch((e) => console.error(e));
  return () => clearInterval(id);
}
