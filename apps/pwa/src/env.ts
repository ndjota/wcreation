import { z } from "zod";

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_API_BASE_URL: z.string().optional(),
  VITE_WS_URL: z.string().optional(),
  VITE_PUBLIC_PATENTE_REF: z.string().optional().default("Modelo de utilidad en trámite"),
});

function parseEnv(): z.infer<typeof schema> {
  return schema.parse({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_WS_URL: import.meta.env.VITE_WS_URL,
    VITE_PUBLIC_PATENTE_REF: import.meta.env.VITE_PUBLIC_PATENTE_REF,
  });
}

export const env = parseEnv();

/** Base URL REST (en desarrollo con proxy de Vite usamos `/api`). */
export function getApiBaseUrl(): string {
  const fromEnv = env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) return "/api";
  return "";
}

export function getWsBaseUrl(): string {
  const fromEnv = env.VITE_WS_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    const { protocol, hostname } = window.location;
    const wsProto = protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${hostname}:3001`;
  }
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${window.location.host}`;
}
