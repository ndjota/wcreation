import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  VPS_DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith("postgres://") || s.startsWith("postgresql://"), "VPS_DATABASE_URL inválida"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  EVENT_SIGNING_KEY: z.string().min(32),
  PUBLIC_APP_URL: z.string().url().default("https://wcreation.ndjota.io"),
  APP_LINK_API_URL: z.string().url().optional(),
});

export type BotConfig = z.infer<typeof envSchema>;

export function loadConfig(): BotConfig {
  const p = envSchema.safeParse(process.env);
  if (!p.success) {
    console.error(p.error.flatten().fieldErrors);
    throw new Error("Variables de entorno inválidas (telegram-bot)");
  }
  return p.data;
}
