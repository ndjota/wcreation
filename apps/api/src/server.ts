import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { loadConfig, type AppConfig } from "./config.js";
import dbVps from "./plugins/db-vps.js";
import dbSupabase from "./plugins/db-supabase.js";
import redis from "./plugins/redis.js";
import auth from "./plugins/auth.js";
import metricsPlugin from "./plugins/metrics.js";
import healthRoutes from "./routes/health.js";
import publicRoutes from "./routes/public.js";
import deviceRoutes from "./routes/devices.js";
import readingsRoutes from "./routes/readings.js";
import eventsRoutes from "./routes/events.js";
import thresholdsRoutes from "./routes/thresholds.js";
import notificationsRoutes from "./routes/notifications.js";
import tenantsRoutes from "./routes/tenants.js";
import adminRoutes from "./routes/admin.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportsRoutes from "./routes/reports.js";
import wsRoutes from "./routes/ws.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    wsClients: Map<WebSocket, Set<string>>;
    ensureWsRedisBridge: () => Promise<void>;
  }
}

function buildLogger(cfg: AppConfig) {
  if (cfg.NODE_ENV === "development") {
    return {
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    };
  }
  return {
    level: "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        '["body"].password',
        '["body"].access_token',
        '["body"].refresh_token',
      ],
      remove: true,
    },
  };
}

export async function buildServer() {
  const cfg = loadConfig();

  const app = Fastify({
    logger: buildLogger(cfg),
    genReqId: () => randomUUID(),
  });

  app.decorate("config", cfg);
  app.decorate("wsClients", new Map<WebSocket, Set<string>>());
  let wsBridgeStarted = false;
  app.decorate("ensureWsRedisBridge", async () => {
    if (wsBridgeStarted) return;
    wsBridgeStarted = true;
    await app.redisSub.psubscribe("wcreation:device:*");
    app.redisSub.on("pmessage", (_pattern, channel, message) => {
      const parts = channel.split(":");
      const deviceId = parts[2];
      if (!deviceId) return;
      for (const [ws, ids] of app.wsClients.entries()) {
        if (ids.has(deviceId) && ws.readyState === 1) {
          const payload = Buffer.isBuffer(message) ? message.toString("utf8") : message;
          ws.send(payload);
        }
      }
    });
  });

  const corsOptions =
    cfg.NODE_ENV === "development"
      ? ({ origin: true, credentials: true } as const)
      : { origin: cfg.corsOrigins, credentials: true };

  await app.register(cors, corsOptions);

  const helmetOpts =
    cfg.NODE_ENV === "production"
      ? ({
          contentSecurityPolicy: false,
          crossOriginEmbedderPolicy: false,
          crossOriginResourcePolicy: { policy: "cross-origin" as const },
          strictTransportSecurity: {
            maxAge: 63072000,
            includeSubDomains: true,
            preload: false,
          },
        } as const)
      : ({
          crossOriginEmbedderPolicy: false,
          crossOriginResourcePolicy: { policy: "cross-origin" as const },
        } as const);

  await app.register(helmet, helmetOpts);

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    allowList: (request) => {
      const path = request.url.split("?")[0] ?? request.url;
      return path === "/health" || path === "/metrics";
    },
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "WCreation API",
        description: "REST + WebSocket — producción",
        version: cfg.API_VERSION,
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Access token JWT emitido por Supabase (rol `authenticated`).",
          },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(websocket);

  await app.register(dbVps, { connectionString: cfg.VPS_DATABASE_URL });
  await app.register(dbSupabase, { url: cfg.SUPABASE_URL, serviceKey: cfg.SUPABASE_SERVICE_ROLE_KEY });
  await app.register(redis, { url: cfg.REDIS_URL });
  await app.register(auth, { cfg });
  await app.register(metricsPlugin);

  await app.register(healthRoutes);
  await app.register(publicRoutes);

  await app.register(async (scoped) => {
    scoped.addHook("preHandler", async (request, reply) => {
      await app.authenticate(request, reply);
      if (reply.sent) return;

      const user = request.authUser;
      if (!user) {
        await reply.status(500).send({ error: "auth_missing" });
        return;
      }
      const uid = user.id;
      const bucket = Math.floor(Date.now() / 60_000);
      const key = `wcreation:rl:user:${uid}:${String(bucket)}`;
      const n = await app.redis.incr(key);
      if (n === 1) await app.redis.expire(key, 120);
      if (n > 1000) {
        await reply.status(429).send({
          error: "rate_limit",
          message: "Superaste el límite de solicitudes por usuario (1000 por minuto).",
        });
      }
    });
    await scoped.register(deviceRoutes);
    await scoped.register(readingsRoutes);
    await scoped.register(eventsRoutes);
    await scoped.register(thresholdsRoutes);
    await scoped.register(notificationsRoutes);
    await scoped.register(tenantsRoutes);
    await scoped.register(adminRoutes);
    await scoped.register(dashboardRoutes);
    await scoped.register(reportsRoutes);
  });

  await app.register(wsRoutes, { cfg });

  app.setErrorHandler((err, _request, reply) => {
    app.log.error(err);
    const e = err instanceof Error ? err : new Error(String(err));
    let status = 500;
    if (typeof err === "object" && err !== null && "statusCode" in err) {
      const rec = err as Record<string, unknown>;
      const sc = rec.statusCode;
      if (typeof sc === "number") status = sc;
    }
    return reply.status(status).send({
      error: e.name,
      message: e.message,
    });
  });

  return app;
}
