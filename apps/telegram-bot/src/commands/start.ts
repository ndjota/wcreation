import type { Context } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";

export function registerStart(bot: import("telegraf").Telegraf, cfg: BotConfig) {
  bot.start(async (ctx: Context) => {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const token = text.split(/\s+/)[1]?.trim();
    if (!token) {
      await ctx.reply("Enviá /start seguido del token que generaste en WCreation → Configuración → Notificaciones.");
      return;
    }
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await sb
      .schema("wcreation")
      .from("telegram_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (error || !row) {
      await ctx.reply("Token inválido o vencido. Generá uno nuevo desde la aplicación.");
      return;
    }
    const exp = new Date(row.expires_at as string).getTime();
    if (Date.now() > exp) {
      await ctx.reply("El token expiró. Generá uno nuevo desde la aplicación.");
      return;
    }
    const chatId = String(ctx.chat?.id ?? "");
    const { error: upErr } = await sb
      .schema("wcreation")
      .from("users")
      .update({ telegram_chat_id: chatId, updated_at: new Date().toISOString() })
      .eq("id", row.user_id as string);
    if (upErr) {
      await ctx.reply("No pudimos vincular tu cuenta. Probá de nuevo más tarde.");
      return;
    }
    await sb.schema("wcreation").from("telegram_link_tokens").delete().eq("token", token);
    await ctx.reply("Listo. Este chat quedó vinculado a tu usuario WCreation. Usá /status para ver tus equipos.");
  });
}
