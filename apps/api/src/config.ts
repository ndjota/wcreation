import "dotenv/config";
import { z } from "zod";

/** En `.env`, las claves opcionales suelen quedar como `VAR=`; tratarlas como ausentes. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_VERSION: z.string().default("1.0.0"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWKS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),

  VPS_DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith("postgres://") || s.startsWith("postgresql://"), "VPS_DATABASE_URL inválida"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),

  MQTT_BROKER_URL: z.string().default("mqtts://127.0.0.1:8883"),

  EVENT_SIGNING_KEY: z.string().min(32, "EVENT_SIGNING_KEY debe tener al menos 32 caracteres"),
  REPORT_SIGNING_KEY: z.preprocess(emptyToUndefined, z.string().min(32).optional()),

  PUBLIC_APP_URL: z.string().url().default("https://wcreation.ndjota.io"),
  /** Base URL del API para enlaces de verificación (JSON). Si no se define, se usa PUBLIC_APP_URL. */
  APP_LINK_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),

  /** Orígenes CORS permitidos (coma). En producción, si queda vacío se usa https://wcreation.ndjota.io */
  CORS_ORIGINS: z.string().optional(),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:soporte@wcreation.ndjota.io"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().default("WCreation <dev@wcreation.local>"),

  RESEND_API_KEY: z.string().optional(),

  TELEGRAM_BOT_USERNAME: z.string().optional(),
});

const envSchema = baseSchema.transform((d) => {
  const fromEnv = d.CORS_ORIGINS ? d.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const corsOrigins =
    fromEnv.length > 0
      ? fromEnv
      : d.NODE_ENV === "production"
        ? ["https://wcreation.ndjota.io"]
        : ["http://localhost:5173", "http://127.0.0.1:5173"];
  return { ...d, corsOrigins };
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Variables de entorno inválidas (ver config.ts / .env.example)");
  }
  return parsed.data;
}

export function reportSigningMaterialKey(cfg: AppConfig): string {
  return cfg.REPORT_SIGNING_KEY ?? cfg.EVENT_SIGNING_KEY;
}

export function linkApiBase(cfg: AppConfig): string {
  return (cfg.APP_LINK_API_URL ?? cfg.PUBLIC_APP_URL).replace(/\/$/, "");
}

export function getJwksUrl(cfg: AppConfig): string {
  if (cfg.SUPABASE_JWKS_URL) return cfg.SUPABASE_JWKS_URL;
  const base = cfg.SUPABASE_URL.replace(/\/+$/, "");
  return `${base}/auth/v1/.well-known/jwks.json`;
}
