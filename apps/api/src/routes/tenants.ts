import type { FastifyPluginAsync } from "fastify";
import * as permissions from "../services/permissions.js";

const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/tenants",
    {
      schema: {
        description: "Listado de tenants (solo superadmin)",
        tags: ["Tenants"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      if (!permissions.isSuperadmin(user)) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const { data, error } = await fastify.supabaseAdmin
        .schema("wcreation")
        .from("tenants")
        .select("id, slug, razon_social, cuit, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { items: data ?? [] };
    },
  );
};

export default tenantsRoutes;
