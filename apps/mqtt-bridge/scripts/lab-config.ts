/**
 * Configuración compartida del laboratorio MQTT (emulador + menú interactivo).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getRepoRoot(): string {
  return path.resolve(__dirname, "../../..");
}

export const rangeSpecSchema = z.object({
  center: z.number(),
  amplitude: z.number().nonnegative().default(0),
  min: z.number(),
  max: z.number(),
});

export const deviceSpecSchema = z.object({
  serial: z.string().min(1),
  device_id: z.string().uuid(),
  enabled: z.boolean().default(true),
  telemetry_interval_ms: z.number().int().positive().default(5000),
  status_interval_ms: z.number().int().positive().default(30_000),
  telemetry: z.object({
    temp_interna: rangeSpecSchema,
    temp_ambiente: rangeSpecSchema,
    bateria_pct: rangeSpecSchema,
    rssi_wifi: rangeSpecSchema,
    fw: z.string().min(1),
    door_open_every_ticks: z.number().int().positive().default(25),
    power_loss_every_ticks: z.number().int().nonnegative().default(0),
  }),
  random_seed: z.number().int().nullable().optional(),
});

export const labConfigSchema = z.object({
  version: z.literal(1),
  tenant_id: z.string().uuid(),
  devices: z.array(deviceSpecSchema),
  supabase_threshold_defaults: z.object({
    temp_interna_min: z.number().nullable(),
    temp_interna_max: z.number().nullable(),
    temp_ambiente_min: z.number().nullable(),
    temp_ambiente_max: z.number().nullable(),
    bateria_min_pct: z.number().int().nullable(),
    corte_red_max_seg: z.number().int().nullable(),
    puerta_abierta_max_seg: z.number().int().nullable(),
    modificable_por_responsable: z.boolean(),
  }),
});

export type LabConfig = z.infer<typeof labConfigSchema>;
export type LabDevice = z.infer<typeof deviceSpecSchema>;
export type LabRange = z.infer<typeof rangeSpecSchema>;

export function defaultLabDevice(serial: string, deviceId: string): LabDevice {
  return {
    serial,
    device_id: deviceId,
    enabled: true,
    telemetry_interval_ms: 5000,
    status_interval_ms: 30_000,
    telemetry: {
      temp_interna: { center: 4.0, amplitude: 1.2, min: 1.0, max: 10.0 },
      temp_ambiente: { center: 24.0, amplitude: 2.0, min: 18.0, max: 32.0 },
      bateria_pct: { center: 90, amplitude: 0, min: 50, max: 100 },
      rssi_wifi: { center: -64, amplitude: 8, min: -88, max: -42 },
      fw: "1.0.3-emulator",
      door_open_every_ticks: 20,
      power_loss_every_ticks: 0,
    },
    random_seed: null,
  };
}

export const DEVICE_PRESETS: ReadonlyArray<{ label: string; serial: string; device_id: string }> = [
  { label: "Heladera demo 1 (seed)", serial: "SN-DEV-001", device_id: "a1111111-1111-1111-1111-111111111111" },
  { label: "Heladera demo 2 (seed)", serial: "SN-DEV-002", device_id: "a2222222-2222-2222-2222-222222222222" },
];

export function defaultConfigPath(): string {
  return path.join(getRepoRoot(), "scripts/emulator/default.config.json");
}

export function labStatePath(): string {
  return path.join(getRepoRoot(), "scripts/emulator/lab-state.json");
}

export function loadLabConfig(p: string): LabConfig {
  const raw = JSON.parse(readFileSync(p, "utf8")) as unknown;
  return labConfigSchema.parse(raw);
}

export function saveLabConfig(p: string, cfg: LabConfig): void {
  const parsed = labConfigSchema.parse(cfg);
  writeFileSync(p, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export async function initSupabaseThresholds(cfg: LabConfig, log: (m: string) => void = console.log): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.length < 20) {
    log(
      "[lab] Umbrales Supabase omitidos: definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (service_role) en .env.",
    );
    return;
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const d = cfg.supabase_threshold_defaults;
  for (const dev of cfg.devices) {
    if (!dev.enabled) continue;
    const row = {
      device_id: dev.device_id,
      temp_interna_min: d.temp_interna_min,
      temp_interna_max: d.temp_interna_max,
      temp_ambiente_min: d.temp_ambiente_min,
      temp_ambiente_max: d.temp_ambiente_max,
      bateria_min_pct: d.bateria_min_pct,
      corte_red_max_seg: d.corte_red_max_seg,
      puerta_abierta_max_seg: d.puerta_abierta_max_seg,
      modificable_por_responsable: d.modificable_por_responsable,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.schema("wcreation").from("device_thresholds").upsert(row, { onConflict: "device_id" });
    if (error) {
      throw new Error(`Supabase umbrales ${dev.serial}: ${error.message}`);
    }
    log(`[lab] Umbrales Supabase OK: ${dev.serial}`);
  }
}
