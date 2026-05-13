import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Rutas `./certs/…` en `.env`: en `tsx` viven bajo `apps/mqtt-bridge/src` → resolver contra raíz del monorepo. En imagen Docker (`dist/`) usá rutas absolutas o relativas al `WORKDIR` del contenedor. */
const monorepoRoot =
  here.includes(`${path.sep}mqtt-bridge${path.sep}src`) || here.endsWith(`${path.sep}mqtt-bridge${path.sep}src`)
    ? path.resolve(here, "..", "..", "..")
    : null;

function resolveCertPath(p: string): string {
  const s = p.trim();
  if (!s || path.isAbsolute(s)) return s;
  if (monorepoRoot) return path.resolve(monorepoRoot, s);
  return path.resolve(process.cwd(), s);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  VPS_DATABASE_URL: z
    .string()
    .refine((s) => s.startsWith("postgres://") || s.startsWith("postgresql://"), "VPS_DATABASE_URL inválida"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  MQTT_BROKER_URL: z.string().default("mqtts://127.0.0.1:8883"),
  MQTT_CLIENT_ID: z.string().default("wcreation-mqtt-bridge"),
  MQTT_CA_PATH: z.string().min(1),
  MQTT_CERT_PATH: z.string().min(1),
  MQTT_KEY_PATH: z.string().min(1),
  EVENT_SIGNING_KEY: z.string().min(32),
});

export type BridgeConfig = z.infer<typeof envSchema>;

export function loadBridgeConfig(): BridgeConfig {
  const p = envSchema.safeParse(process.env);
  if (!p.success) {
    console.error(p.error.flatten().fieldErrors);
    throw new Error("Variables de entorno inválidas (mqtt-bridge)");
  }
  const d = p.data;
  return {
    ...d,
    MQTT_CA_PATH: resolveCertPath(d.MQTT_CA_PATH),
    MQTT_CERT_PATH: resolveCertPath(d.MQTT_CERT_PATH),
    MQTT_KEY_PATH: resolveCertPath(d.MQTT_KEY_PATH),
  };
}
