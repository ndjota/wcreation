import { buildServer } from "./server.js";
import { startNotificationDispatcher } from "./services/notifications.service.js";

const app = await buildServer();
const cfg = app.config;
const stopNotifications = startNotificationDispatcher(app);

await app.listen({ host: cfg.API_HOST, port: cfg.API_PORT });
app.log.info(`API escuchando en http://${cfg.API_HOST}:${cfg.API_PORT} — docs: /docs`);

const shutdown = async () => {
  stopNotifications();
  await app.close();
};
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
