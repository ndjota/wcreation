import type { Context } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";
import { loadUserFromChat } from "../middleware/auth.js";

export function registerAlerts(bot: import("telegraf").Telegraf, cfg: BotConfig) {
  bot.command("alerts", async (ctx: Context) => {
    const chatId = String(ctx.chat?.id ?? "");
    const u = await loadUserFromChat(cfg, chatId);
    if (!u) {
      await ctx.reply("Chat no vinculado.");
      return;
    }
    const arg = (ctx.message && "text" in ctx.message ? ctx.message.text : "").split(/\s+/)[1]?.toLowerCase();
    if (arg !== "on" && arg !== "off") {
      await ctx.reply("Uso: /alerts on | /alerts off");
      return;
    }
    const paused = arg === "off";
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await sb
      .schema("wcreation")
      .from("users")
      .update({ notifications_paused: paused, updated_at: new Date().toISOString() })
      .eq("id", u.id);
    if (error) {
      await ctx.reply("No se pudo actualizar la preferencia.");
      return;
    }
    await ctx.reply(paused ? "Alertas pausadas para tu usuario." : "Alertas activadas.");
  });
}
