import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import pg from "pg";

declare module "fastify" {
  interface FastifyInstance {
    pgPool: pg.Pool;
  }
}

const dbVpsPlugin: FastifyPluginAsync<{ connectionString: string }> = async (fastify, opts) => {
  const pool = new pg.Pool({
    connectionString: opts.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  fastify.decorate("pgPool", pool);
  fastify.addHook("onClose", async () => {
    await pool.end();
  });
};

export default fp(dbVpsPlugin, { name: "wcreation-db-vps", encapsulate: false });
