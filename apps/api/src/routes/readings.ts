import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as permissions from "../services/permissions.js";
import { queryReadings } from "../services/readings.service.js";

const params = z.object({ id: z.string().uuid() });
const query = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  interval: z.enum(["raw", "1m", "5m", "1h", "1d"]).default("raw"),
});

const readingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/devices/:id/readings",
    {
      schema: {
        description: "Serie temporal de lecturas (Timescale)",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const { id } = params.parse(request.params);
      if (!(await permissions.canViewDevice(fastify, user, id))) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const q = query.parse(request.query);
      const to = q.to ? new Date(q.to) : new Date();
      const from = q.from ? new Date(q.from) : new Date(to.getTime() - 24 * 3600 * 1000);
      const rows = await queryReadings({
        pool: fastify.pgPool,
        deviceId: id,
        from,
        to,
        interval: q.interval,
      });
      return { items: rows };
    },
  );
};

export default readingsRoutes;
