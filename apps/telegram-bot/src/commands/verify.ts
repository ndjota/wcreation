import type { Context } from "telegraf";
import type { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";
import { loadUserFromChat } from "../middleware/auth.js";
import { verifyDeviceLastChain } from "../lib/verify-chain.js";

export function registerVerify(bot: import("telegraf").Telegraf, cfg: BotConfig, pool: Pool) {
  bot.command("verify", async (ctx: Context) => {
    const serial = (ctx.message && "text" in ctx.message ? ctx.message.text : "").split(/\s+/).slice(1).join(" ").trim();
    if (!serial) {
      await ctx.reply("Uso: /verify <número_de_serie>");
      return;
    }
    const chatId = String(ctx.chat?.id ?? "");
    const u = await loadUserFromChat(cfg, chatId);
    if (!u) {
      await ctx.reply("Chat no vinculado.");
      return;
    }
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = sb.schema("wcreation").from("devices").select("id").eq("serial_number", serial);
    if (u.tenant_id) q = q.eq("tenant_id", u.tenant_id);
    const { data: d, error } = await q.maybeSingle();
    if (error || !d) {
      await ctx.reply("Dispositivo no encontrado.");
      return;
    }
    const res = await verifyDeviceLastChain(pool, d.id as string, cfg.EVENT_SIGNING_KEY);
    await ctx.reply(
      [
        `Cadena (último evento) serial ${serial}:`,
        `Firma válida: ${res.firma_valida ? "sí" : "no"}`,
        `Cadena válida: ${res.cadena_valida ? "sí" : "no"}`,
        `Hash inicial: ${res.primer_hash ?? "—"}`,
        `Hash final: ${res.ultimo_hash || "—"}`,
      ].join("\n"),
    );
  });
}
