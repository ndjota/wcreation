import type { Context } from "telegraf";

/** Reservado para futuras restricciones multi\\-tenant en comandos. */
export function loadTenantMiddleware() {
  return async (_ctx: Context, next: () => Promise<void>) => {
    await next();
  };
}
