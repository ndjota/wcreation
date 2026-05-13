import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as permissions from "../services/permissions.js";
import { listEvents, verifyEventChain } from "../services/events.service.js";

const params = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  tipo: z.string().optional(),
  severidad: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const verifyParams = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
});

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/devices/:id/events",
    {
      schema: {
        description: "Eventos firmados del dispositivo",
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
      const q = listQuery.parse(request.query);
      let cursorTs: string | undefined;
      let cursorId: string | undefined;
      if (q.cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(q.cursor, "base64url").toString("utf8")) as {
            ts: string;
            id: string;
          };
          cursorTs = decoded.ts;
          cursorId = decoded.id;
        } catch {
          return reply.status(400).send({ error: "invalid_cursor" });
        }
      }
      const { rows, nextCursor } = await listEvents({
        pool: fastify.pgPool,
        deviceId: id,
        limit: q.limit,
        ...(q.from ? { from: new Date(q.from) } : {}),
        ...(q.to ? { to: new Date(q.to) } : {}),
        ...(q.tipo ? { tipo: q.tipo } : {}),
        ...(q.severidad ? { severidad: q.severidad } : {}),
        ...(cursorTs && cursorId ? { cursorTs, cursorId } : {}),
      });
      const next = nextCursor
        ? Buffer.from(JSON.stringify(nextCursor), "utf8").toString("base64url")
        : null;
      return {
        items: rows,
        next_cursor: next,
      };
    },
  );

  fastify.get(
    "/devices/:id/events/:event_id/verify",
    {
      schema: {
        description: "Verifica firma SHA-256 y cadena de hashes",
        tags: ["Dispositivos"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.authUser!;
      const { id, event_id } = verifyParams.parse(request.params);
      if (!(await permissions.canViewDevice(fastify, user, id))) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const result = await verifyEventChain(fastify.pgPool, id, event_id, fastify.config.EVENT_SIGNING_KEY);
      if ("error" in result && result.error === "evento_no_encontrado") {
        return reply.status(404).send(result);
      }
      return result;
    },
  );
};

export default eventsRoutes;
