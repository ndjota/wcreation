/**
 * Cadena de integridad de eventos en Timescale (Node.js únicamente).
 * Export vía `@wcreation/shared/signing` para no arrastrar node:crypto al bundle PWA.
 */
import { createHash } from "node:crypto";

/** Serialización estable de JSON para el material de firma (claves ordenadas). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Material firmado: payload canónico + instante + dispositivo + eslabón anterior + secreto servidor.
 * El secreto nunca se persiste; solo se usa en runtime en API y mqtt-bridge.
 */
export function eventSigningMaterial(input: {
  payload: Record<string, unknown>;
  tsIso: string;
  deviceId: string;
  hashAnterior: string | null;
  signingKey: string;
}): string {
  return [
    stableStringify(input.payload),
    input.tsIso,
    input.deviceId,
    input.hashAnterior ?? "",
    input.signingKey,
  ].join("|");
}

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function computeEventHash(input: {
  payload: Record<string, unknown>;
  tsIso: string;
  deviceId: string;
  hashAnterior: string | null;
  signingKey: string;
}): string {
  return sha256Hex(eventSigningMaterial(input));
}
