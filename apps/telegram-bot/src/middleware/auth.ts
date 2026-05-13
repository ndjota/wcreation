import type { Context } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import type { BotConfig } from "../config.js";

export interface WcCtx {
  wcUserId?: string;
  wcTenantId?: string | null;
}

export async function loadUserFromChat(
  cfg: BotConfig,
  chatId: string,
): Promise<{ id: string; tenant_id: string | null; notifications_paused: boolean } | null> {
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .schema("wcreation")
    .from("users")
    .select("id, tenant_id, notifications_paused")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    tenant_id: (data.tenant_id as string | null) ?? null,
    notifications_paused: Boolean(data.notifications_paused),
  };
}

export function requireAuth(cfg: BotConfig) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const chatId = ctx.chat?.id != null ? String(ctx.chat.id) : "";
    if (!chatId) return;
    const u = await loadUserFromChat(cfg, chatId);
    if (!u) {
      await ctx.reply("Tu chat no está vinculado. Usá /start con el token que te dio WCreation.");
      return;
    }
    (ctx as Context & { state: WcCtx }).state.wcUserId = u.id;
    (ctx as Context & { state: WcCtx }).state.wcTenantId = u.tenant_id;
    await next();
  };
}
