import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "ws";
import { createSupabaseJwtVerifier } from "../lib/jwt.js";
import type { AppConfig } from "../config.js";
import * as permissions from "../services/permissions.js";

interface SubscribeMsg {
  action: "subscribe";
  device_ids: string[];
}

const wsRoutes: FastifyPluginAsync<{ cfg: AppConfig }> = async (fastify, opts) => {
  const verify = createSupabaseJwtVerifier(opts.cfg);

  fastify.get(
    "/ws/realtime",
    { websocket: true },
    async (socket: WebSocket, request) => {
      const q = request.query as { access_token?: string };
      const token = q.access_token;
      if (!token) {
        socket.close(4401, "missing access_token");
        return;
      }
      let sub: string;
      try {
        const claims = await verify(token);
        sub = claims.sub;
      } catch {
        socket.close(4401, "invalid token");
        return;
      }

      const { data: u } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("users")
        .select("id, tenant_id, role_code, activo")
        .eq("id", sub)
        .maybeSingle();

      if (!u?.activo) {
        socket.close(4403, "inactive user");
        return;
      }

      const authUser = {
        id: u.id as string,
        email: "",
        tenantId: (u.tenant_id as string | null) ?? null,
        roleCode: u.role_code as "superadmin" | "owner_admin" | "responsable" | "public_viewer",
        jerarquia: 0,
      };
      const { data: roleRow } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("roles")
        .select("jerarquia")
        .eq("code", u.role_code as string)
        .maybeSingle();
      authUser.jerarquia = (roleRow?.jerarquia as number) ?? 0;

      await fastify.ensureWsRedisBridge();

      const allowed = new Set<string>();
      fastify.wsClients.set(socket, allowed);

      socket.on("message", async (raw: unknown) => {
        try {
          const msg = JSON.parse(String(raw)) as SubscribeMsg;
          if (msg.action !== "subscribe" || !Array.isArray(msg.device_ids)) return;
          for (const id of msg.device_ids) {
            if (await permissions.canViewDevice(fastify, authUser, id)) allowed.add(id);
          }
        } catch {
          /* ignore */
        }
      });

      socket.on("close", () => {
        fastify.wsClients.delete(socket);
      });
    },
  );
};

export default wsRoutes;
