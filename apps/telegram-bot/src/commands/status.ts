import type { Context } from "telegraf";
import type { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";
import { loadUserFromChat } from "../middleware/auth.js";

export function registerStatus(bot: import("telegraf").Telegraf, cfg: BotConfig, pool: Pool) {
  bot.command("status", async (ctx: Context) => {
    const chatId = String(ctx.chat?.id ?? "");
    const u = await loadUserFromChat(cfg, chatId);
    if (!u) {
      await ctx.reply("Chat no vinculado. Usá /start con el token que te dio la aplicación.");
      return;
    }
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = sb.schema("wcreation").from("devices").select("id, nombre, serial_number, estado");
    if (u.tenant_id) q = q.eq("tenant_id", u.tenant_id);
    const { data: devs, error } = await q;
    if (error) {
      await ctx.reply("Error al cargar dispositivos.");
      return;
    }
    const lines: string[] = ["Tus dispositivos"];
    for (const d of devs ?? []) {
      const id = d.id as string;
      const mv = await pool.query(
        `SELECT last_reading_ts, ultimos_eventos_criticos FROM wcreation.device_last_state WHERE device_id = $1`,
        [id],
      );
      const r = mv.rows[0];
      const last = r?.last_reading_ts ? new Date(r.last_reading_ts as string).toLocaleString("es-AR") : "—";
    lines.push(`• ${String(d.nombre)} (${String(d.serial_number)}) — ${String(d.estado)} — últ.: ${last}`);
    }
    await ctx.reply(lines.join("\n"));
  });
}
