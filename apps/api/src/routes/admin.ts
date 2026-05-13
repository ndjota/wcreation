import type { FastifyPluginAsync } from "fastify";
import * as permissions from "../services/permissions.js";
import { syncDevicesReplicaFromSupabase } from "../services/sync.service.js";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/admin/sync-devices",
    {
      schema: {
        description: "Fuerza sincronización devices_replica (solo superadmin)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      if (!permissions.isSuperadmin(user)) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const n = await syncDevicesReplicaFromSupabase(fastify);
      return { ok: true, sincronizados: n };
    },
  );
};

export default adminRoutes;
