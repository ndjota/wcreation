import { createServer } from "node:http";
import pg from "pg";
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";
import { registerStart } from "./commands/start.js";
import { registerStatus } from "./commands/status.js";
import { registerStatusDevice } from "./commands/status_device.js";
import { registerAlerts } from "./commands/alerts.js";
import { registerHelp } from "./commands/help.js";
import { registerVerify } from "./commands/verify.js";
import { startTelegramNotificationWorker } from "./handlers/notifications.js";

const cfg = loadConfig();
const pool = new pg.Pool({ connectionString: cfg.VPS_DATABASE_URL, max: 5 });
const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const bot = new Telegraf(cfg.TELEGRAM_BOT_TOKEN);

registerStart(bot, cfg);
registerStatus(bot, cfg, pool);
registerStatusDevice(bot, cfg, pool);
registerAlerts(bot, cfg);
registerHelp(bot);
registerVerify(bot, cfg, pool);

const stopWorker = startTelegramNotificationWorker({ bot, pool, cfg, sb });

await bot.launch();
console.log("[telegram-bot] en línea");

const healthPort = Number(process.env.HEALTH_LISTEN_PORT ?? 0);
if (healthPort > 0) {
  createServer(async (req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404).end();
      return;
    }
    try {
      await pool.query("SELECT 1");
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
    } catch {
      res.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "degraded" }));
    }
  }).listen(healthPort, "0.0.0.0", () => {
    console.log(`[telegram-bot] health HTTP :${healthPort}`);
  });
}

const shutdown = async () => {
  stopWorker();
  await bot.stop("SIGINT");
  await pool.end();
};

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
