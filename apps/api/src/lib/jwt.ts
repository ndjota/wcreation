/**
 * Verificación de JWT de Supabase con JWKS remoto (rotación de claves).
 * Usamos `jose` en lugar de depender solo de @fastify/jwt con clave estática.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AppConfig } from "../config.js";
import { getJwksUrl } from "../config.js";

export interface SupabaseAccessClaims extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  /** `authenticated` en sesiones de usuario. */
  aud?: string | string[];
}

export function createSupabaseJwtVerifier(cfg: AppConfig) {
  const jwks = createRemoteJWKSet(new URL(getJwksUrl(cfg)));
  const issuer = `${cfg.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1`;

  return async function verifyAccessToken(token: string): Promise<SupabaseAccessClaims> {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: "authenticated",
    });
    return payload as SupabaseAccessClaims;
  };
}
