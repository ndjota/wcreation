import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        description: "Estado del API y dependencias",
        tags: ["Sistema"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              db_vps: { type: "string" },
              redis: { type: "string" },
              mqtt: { type: "string" },
              supabase: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      let db_vps = "error";
      let redis = "error";
      let supabase = "error";
      try {
        await fastify.pgPool.query("SELECT 1");
        db_vps = "ok";
      } catch {
        db_vps = "error";
      }
      try {
        const pong = await fastify.redis.ping();
        redis = pong === "PONG" ? "ok" : "error";
      } catch {
        redis = "error";
      }
      try {
        const { error } = await fastify.supabaseAdmin.schema("wcreation").from("tenants").select("id").limit(1);
        supabase = error ? "error" : "ok";
      } catch {
        supabase = "error";
      }

      const mqtt = fastify.config.MQTT_BROKER_URL ? "configured" : "unknown";

      const status = [db_vps, redis, supabase].every((x) => x === "ok") ? "ok" : "degraded";
      return {
        status,
        version: fastify.config.API_VERSION,
        db_vps,
        redis,
        mqtt,
        supabase,
      };
    },
  );
};

export default healthRoutes;
