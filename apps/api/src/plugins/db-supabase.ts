import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare module "fastify" {
  interface FastifyInstance {
    supabaseAdmin: SupabaseClient;
  }
}

const dbSupabasePlugin: FastifyPluginAsync<{ url: string; serviceKey: string }> = async (fastify, opts) => {
  const client = createClient(opts.url, opts.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  fastify.decorate("supabaseAdmin", client);
};

export default fp(dbSupabasePlugin, { name: "wcreation-supabase", encapsulate: false });
