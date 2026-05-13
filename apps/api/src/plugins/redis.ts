import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";

type RedisConn = InstanceType<typeof Redis>;

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisConn;
    /** Conexión dedicada a `SUBSCRIBE` (no reutilizar para comandos). */
    redisSub: RedisConn;
  }
}

const redisPlugin: FastifyPluginAsync<{ url: string }> = async (fastify, opts) => {
  const redis = new Redis(opts.url, { maxRetriesPerRequest: 2 });
  const redisSub = new Redis(opts.url, { maxRetriesPerRequest: 2 });
  fastify.decorate("redis", redis);
  fastify.decorate("redisSub", redisSub);
  fastify.addHook("onClose", async () => {
    redis.disconnect();
    redisSub.disconnect();
  });
};

export default fp(redisPlugin, { name: "wcreation-redis", encapsulate: false });
