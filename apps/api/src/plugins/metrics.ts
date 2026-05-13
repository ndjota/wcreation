import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  await Promise.resolve();
  const register = new Registry();
  collectDefaultMetrics({ register, prefix: "wcreation_process_" });

  const httpRequests = new Counter({
    name: "wcreation_http_requests_total",
    help: "Total de respuestas HTTP del API",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  const httpDuration = new Histogram({
    name: "wcreation_http_request_duration_seconds",
    help: "Latencia de respuestas HTTP (segundos)",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  });

  fastify.addHook("onRequest", (request) => {
    (request as { _wcreationMetricsStart?: bigint })._wcreationMetricsStart = process.hrtime.bigint();
  });

  fastify.addHook("onResponse", (request, reply) => {
    const url = request.url.split("?")[0] ?? request.url;
    if (url === "/metrics" || url === "/health" || url.startsWith("/docs")) return;

    const start = (request as { _wcreationMetricsStart?: bigint })._wcreationMetricsStart;
    if (start === undefined) return;
    const fallback = request.url.split("?")[0] ?? request.url;
    const route = request.routeOptions.url ?? fallback;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    httpRequests.inc(labels);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpDuration.observe(labels, seconds);
  });

  fastify.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
  });
};

export default fp(metricsPlugin, { name: "wcreation-metrics", encapsulate: false });
