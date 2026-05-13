import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

const prefBody = z.object({
  canal: z.enum(["email", "push", "telegram"]),
  evento_tipo: z.string().min(1).max(80),
  habilitado: z.boolean(),
  telegram_chat_id: z.string().nullable().optional(),
});

const pushBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  user_agent: z.string().max(500).optional(),
});

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/notifications/preferences",
    {
      schema: {
        description: "Preferencias de notificación del usuario autenticado",
        tags: ["Notificaciones"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.authUser!;
      const { data, error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return { items: data ?? [] };
    },
  );

  fastify.put(
    "/notifications/preferences",
    {
      schema: {
        description: "Upsert de una preferencia",
        tags: ["Notificaciones"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.authUser!;
      const body = prefBody.parse(request.body);
      const { error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            canal: body.canal,
            evento_tipo: body.evento_tipo,
            habilitado: body.habilitado,
            telegram_chat_id: body.telegram_chat_id ?? null,
          },
          { onConflict: "user_id,canal,evento_tipo" },
        );
      if (error) throw error;
      return { ok: true };
    },
  );

  const upsertPush = async (request: FastifyRequest) => {
    const user = request.authUser!;
    const body = pushBody.parse(request.body);
    const { error } = await fastify.supabaseAdmin.schema("wcreation").from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth_secret: body.keys.auth,
        user_agent: body.user_agent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    return { ok: true };
  };

  fastify.post(
    "/push/subscribe",
    {
      schema: {
        description: "Registra suscripción Web Push (VAPID en el cliente)",
        tags: ["Notificaciones"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => upsertPush(request),
  );

  fastify.post(
    "/notifications/push/register",
    {
      schema: {
        description: "Alias de /push/subscribe",
        tags: ["Notificaciones"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => upsertPush(request),
  );

  fastify.post(
    "/push/unsubscribe",
    {
      schema: {
        description: "Elimina una suscripción Web Push por endpoint",
        tags: ["Notificaciones"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.authUser!;
      const b = z.object({ endpoint: z.string().url() }).parse(request.body);
      const { error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", b.endpoint);
      if (error) throw error;
      return { ok: true };
    },
  );

  fastify.get(
    "/push/vapid-public-key",
    {
      schema: {
        description: "Clave pública VAPID para Web Push",
        tags: ["Notificaciones"],
      },
    },
    async () => ({ publicKey: fastify.config.VAPID_PUBLIC_KEY ?? null }),
  );

  fastify.post(
    "/telegram/link",
    {
      schema: {
        description: "Genera URL para vincular Telegram (/start token)",
        tags: ["Notificaciones"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.authUser!;
      const { randomBytes } = await import("node:crypto");
      const token = randomBytes(9).toString("base64url");
      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const { error } = await fastify.supabaseAdmin.schema("wcreation").from("telegram_link_tokens").insert({
        token,
        user_id: user.id,
        expires_at: expiresAt,
      });
      if (error) throw error;
      const bot = fastify.config.TELEGRAM_BOT_USERNAME ?? "wcreation_bot";
      return { token, expires_at: expiresAt, url: `https://t.me/${bot}?start=${token}` };
    },
  );
};

export default notificationsRoutes;
