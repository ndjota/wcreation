import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { RoleCode } from "@wcreation/shared";
import { createSupabaseJwtVerifier } from "../lib/jwt.js";
import type { AppConfig } from "../config.js";

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  roleCode: RoleCode;
  jerarquia: number;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

const authPlugin: FastifyPluginAsync<{ cfg: AppConfig }> = async (fastify, opts) => {
  const verify = createSupabaseJwtVerifier(opts.cfg);

  fastify.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const h = request.headers.authorization;
      if (!h?.startsWith("Bearer ")) {
        await reply.status(401).send({ error: "missing_bearer", message: "Se requiere Authorization: Bearer" });
        return;
      }
      const token = h.slice("Bearer ".length).trim();
      let sub: string;
      try {
        const claims = await verify(token);
        sub = claims.sub;
      } catch {
        await reply.status(401).send({ error: "invalid_token", message: "JWT inválido o expirado" });
        return;
      }

      const { data: u, error: eUser } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("users")
        .select("id, email, tenant_id, role_code, activo")
        .eq("id", sub)
        .maybeSingle();

      if (eUser) {
        request.log.error({ eUser }, "supabase users lookup");
        await reply.status(500).send({ error: "auth_lookup_failed" });
        return;
      }
      if (!u?.activo) {
        await reply.status(403).send({ error: "user_inactive" });
        return;
      }

      const { data: roleRow, error: eRole } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("roles")
        .select("jerarquia")
        .eq("code", u.role_code as string)
        .maybeSingle();

      if (eRole || roleRow?.jerarquia === undefined) {
        request.log.error({ eRole }, "supabase roles lookup");
        await reply.status(500).send({ error: "role_missing" });
        return;
      }

      request.authUser = {
        id: u.id as string,
        email: u.email as string,
        tenantId: (u.tenant_id as string | null) ?? null,
        roleCode: u.role_code as RoleCode,
        jerarquia: roleRow.jerarquia as number,
      };
    },
  );
};

export default fp(authPlugin, { name: "wcreation-auth", encapsulate: false });

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
