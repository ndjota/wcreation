import type { Context } from "telegraf";
import type { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";
import { loadUserFromChat } from "../middleware/auth.js";

function asciiSparkline(values: number[], rows = 5, cols = 18): string {
  if (values.length === 0) return "(sin datos)";
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const span = Math.max(1e-6, mx - mn);
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(" "));
  const step = Math.max(1, Math.floor(values.length / cols));
  for (let c = 0; c < cols; c += 1) {
    const idx = Math.min(values.length - 1, c * step);
    const v = values[idx]!;
    const row = Math.round((1 - (v - mn) / span) * (rows - 1));
    grid[row]![c] = "·";
  }
  return grid.map((r) => r.join("")).join("\n");
}

export function registerStatusDevice(bot: import("telegraf").Telegraf, cfg: BotConfig, pool: Pool) {
  bot.hears(/^\/status_(.+)$/i, async (ctx: Context) => {
    const m = (ctx.message && "text" in ctx.message ? ctx.message.text : "").match(/^\/status_(.+)$/i);
    const serial = m?.[1]?.trim();
    if (!serial) return;
    const chatId = String(ctx.chat?.id ?? "");
    const u = await loadUserFromChat(cfg, chatId);
    if (!u) {
      await ctx.reply("Chat no vinculado.");
      return;
    }
    const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = sb.schema("wcreation").from("devices").select("id, nombre, serial_number, estado").eq("serial_number", serial);
    if (u.tenant_id) q = q.eq("tenant_id", u.tenant_id);
    const { data: d, error } = await q.maybeSingle();
    if (error || !d) {
      await ctx.reply("No encontramos ese número de serie en tu cuenta.");
      return;
    }
    const id = d.id as string;
    const r = await pool.query(
      `SELECT ts, temp_interna FROM wcreation.readings
       WHERE device_id = $1::uuid AND ts >= now() - interval '6 hours'
       ORDER BY ts ASC`,
      [id],
    );
    const temps = r.rows.map((x) => Number(x.temp_interna)).filter((x) => !Number.isNaN(x));
    const spark = asciiSparkline(temps);
    await ctx.reply(
      `${String(d.nombre)} (${String(d.serial_number)})\nEstado: ${String(d.estado)}\nÚltimas 6 h (aprox.):\n${spark}`,
    );
  });
}
