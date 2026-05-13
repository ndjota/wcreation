/**
 * Menú interactivo (ABM) de sensores emulados y umbrales Supabase por defecto.
 * Persistencia: scripts/emulator/lab-state.json
 *
 *   pnpm emulator:menu
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { config as loadDotenv } from "dotenv";
import {
  defaultConfigPath,
  defaultLabDevice,
  DEVICE_PRESETS,
  getRepoRoot,
  initSupabaseThresholds,
  labStatePath,
  loadLabConfig,
  saveLabConfig,
  type LabConfig,
  type LabDevice,
  type LabRange,
} from "./lab-config.js";

loadDotenv({ path: path.join(getRepoRoot(), ".env") });

const STATE = labStatePath();
const REPO = getRepoRoot();

function ensureState(): LabConfig {
  if (!existsSync(STATE)) {
    const d = loadLabConfig(defaultConfigPath());
    saveLabConfig(STATE, d);
    console.log("\n[lab] Archivo de trabajo creado:", STATE, "\n");
    return d;
  }
  return loadLabConfig(STATE);
}

async function ask(rl: ReturnType<typeof createInterface>, q: string, def?: string): Promise<string> {
  const hint = def !== undefined && def !== "" ? ` [${def}]` : "";
  const line = (await rl.question(`${q}${hint}: `)).trim();
  if (line === "") return def ?? "";
  return line;
}

async function askNum(rl: ReturnType<typeof createInterface>, q: string, def: number): Promise<number> {
  const s = await ask(rl, q, String(def));
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : def;
}

async function askInt(rl: ReturnType<typeof createInterface>, q: string, def: number): Promise<number> {
  const n = Math.round(await askNum(rl, q, def));
  return Number.isFinite(n) ? n : def;
}

async function askBool(rl: ReturnType<typeof createInterface>, q: string, def: boolean): Promise<boolean> {
  const s = (await ask(rl, `${q} (s/n)`, def ? "s" : "n")).toLowerCase();
  if (s === "s" || s === "si" || s === "y" || s === "yes") return true;
  if (s === "n" || s === "no") return false;
  return def;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function printDevices(cfg: LabConfig): void {
  if (cfg.devices.length === 0) {
    console.log("  (sin sensores — agregá uno con la opción 2)\n");
    return;
  }
  cfg.devices.forEach((d, i) => {
    const on = d.enabled ? "ON " : "OFF";
    console.log(
      `  [${i}] ${on}  ${d.serial}  uuid=${d.device_id}  telem=${d.telemetry_interval_ms}ms  status=${d.status_interval_ms}ms`,
    );
    console.log(
      `       Tint ${d.telemetry.temp_interna.center}±${d.telemetry.temp_interna.amplitude} [${d.telemetry.temp_interna.min}..${d.telemetry.temp_interna.max}]`,
    );
  });
  console.log("");
}

async function editRange(rl: ReturnType<typeof createInterface>, label: string, r: LabRange): Promise<LabRange> {
  console.log(`\n--- Rango: ${label} ---`);
  return {
    center: await askNum(rl, "  center", r.center),
    amplitude: await askNum(rl, "  amplitude (0 = fijo)", r.amplitude),
    min: await askNum(rl, "  min", r.min),
    max: await askNum(rl, "  max", r.max),
  };
}

async function editTelemetryBlock(rl: ReturnType<typeof createInterface>, d: LabDevice): Promise<void> {
  const t = d.telemetry;
  console.log(`\n=== Telemetría: ${d.serial} ===`);
  let sub = true;
  while (sub) {
    console.log(`
  1) temp_interna   2) temp_ambiente   3) bateria_pct   4) rssi_wifi
  5) fw / puerta / corte red   0) Volver`);
    const c = await ask(rl, "Submenú");
    switch (c) {
      case "1":
        t.temp_interna = await editRange(rl, "temp_interna", t.temp_interna);
        break;
      case "2":
        t.temp_ambiente = await editRange(rl, "temp_ambiente", t.temp_ambiente);
        break;
      case "3":
        t.bateria_pct = await editRange(rl, "bateria_pct", t.bateria_pct);
        break;
      case "4":
        t.rssi_wifi = await editRange(rl, "rssi_wifi", t.rssi_wifi);
        break;
      case "5":
        t.fw = await ask(rl, "Firmware (fw)", t.fw);
        t.door_open_every_ticks = await askInt(rl, "Puerta abierta cada N ticks (1+)", t.door_open_every_ticks);
        t.power_loss_every_ticks = await askInt(
          rl,
          "Corte red cada N ticks (0 = nunca)",
          t.power_loss_every_ticks,
        );
        break;
      case "0":
        sub = false;
        break;
      default:
        console.log("Opción no válida.");
    }
  }
}

async function pickDeviceIndex(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<number | null> {
  if (cfg.devices.length === 0) {
    console.log("No hay sensores.");
    return null;
  }
  printDevices(cfg);
  const s = await ask(rl, "Índice del sensor");
  const i = parseInt(s, 10);
  if (!Number.isFinite(i) || i < 0 || i >= cfg.devices.length) {
    console.log("Índice inválido.");
    return null;
  }
  return i;
}

async function addSensor(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  console.log(`
--- Agregar sensor ---
  1) Preset seed (SN-DEV-001 / SN-DEV-002)
  2) Manual (serial + UUID)`);
  const mode = await ask(rl, "Modo", "1");
  if (mode === "1") {
    DEVICE_PRESETS.forEach((p, i) => console.log(`  [${i + 1}] ${p.label} → ${p.serial}`));
    const n = parseInt(await ask(rl, "Elegí preset (número)", "1"), 10);
    const p = DEVICE_PRESETS[n - 1];
    if (!p) {
      console.log("Preset inválido.");
      return;
    }
    if (cfg.devices.some((d) => d.serial === p.serial)) {
      console.log("Ese serial ya existe en la lista.");
      return;
    }
    const base = defaultLabDevice(p.serial, p.device_id);
    cfg.devices.push(base);
    console.log(`Agregado: ${p.serial}`);
    return;
  }
  const serial = await ask(rl, "Número de serie (CN del cert, ej. SN-DEV-003)", "");
  if (!serial) {
    console.log("Serial vacío.");
    return;
  }
  if (cfg.devices.some((d) => d.serial === serial)) {
    console.log("Serial duplicado.");
    return;
  }
  let deviceId = await ask(rl, "UUID device_id (Postgres/Supabase)", "");
  if (!isUuid(deviceId)) {
    console.log("UUID inválido. Generá uno en la DB o usá un preset.");
    return;
  }
  cfg.devices.push(defaultLabDevice(serial, deviceId));
  console.log(`Agregado: ${serial}`);
}

async function editSensor(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  const idx = await pickDeviceIndex(rl, cfg);
  if (idx === null) return;
  const d = cfg.devices[idx]!;
  let sub = true;
  while (sub) {
    console.log(`
--- Editar [${idx}] ${d.serial} (${d.enabled ? "habilitado" : "deshabilitado"}) ---
  1) Serial   2) UUID device_id   3) Habilitado
  4) Intervalos (telemetría / status)
  5) Bloque telemetría (rangos, fw, puerta, corte red)
  6) random_seed (entero o vacío=null)
  0) Volver`);
    const c = await ask(rl, "Opción");
    switch (c) {
      case "1": {
        const s = await ask(rl, "Serial", d.serial);
        if (s) d.serial = s;
        break;
      }
      case "2": {
        const id = await ask(rl, "device_id UUID", d.device_id);
        if (isUuid(id)) d.device_id = id;
        else console.log("UUID inválido.");
        break;
      }
      case "3":
        d.enabled = await askBool(rl, "¿Habilitado?", d.enabled);
        break;
      case "4":
        d.telemetry_interval_ms = await askInt(rl, "telemetry_interval_ms (ms)", d.telemetry_interval_ms);
        d.status_interval_ms = await askInt(rl, "status_interval_ms (ms)", d.status_interval_ms);
        break;
      case "5":
        await editTelemetryBlock(rl, d);
        break;
      case "6": {
        const rs = await ask(rl, "random_seed (vacío = null)", d.random_seed == null ? "" : String(d.random_seed));
        if (rs === "") d.random_seed = null;
        else {
          const n = parseInt(rs, 10);
          d.random_seed = Number.isFinite(n) ? n : null;
        }
        break;
      }
      case "0":
        sub = false;
        break;
      default:
        console.log("Opción no válida.");
    }
  }
}

async function toggleSensor(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  const idx = await pickDeviceIndex(rl, cfg);
  if (idx === null) return;
  cfg.devices[idx]!.enabled = !cfg.devices[idx]!.enabled;
  console.log(`Ahora: ${cfg.devices[idx]!.enabled ? "habilitado" : "deshabilitado"}`);
}

async function deleteSensor(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  const idx = await pickDeviceIndex(rl, cfg);
  if (idx === null) return;
  const ok = await askBool(rl, `¿Eliminar ${cfg.devices[idx]!.serial}?`, false);
  if (!ok) return;
  cfg.devices.splice(idx, 1);
  console.log("Eliminado.");
}

async function editTenant(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  const id = await ask(rl, "tenant_id (UUID)", cfg.tenant_id);
  if (isUuid(id)) cfg.tenant_id = id;
  else console.log("UUID inválido.");
}

async function editGlobalThresholds(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  const d = cfg.supabase_threshold_defaults;
  console.log("\n--- Umbrales por defecto (Supabase device_thresholds) ---");
  d.temp_interna_min = await askNum(rl, "temp_interna_min", d.temp_interna_min ?? 2);
  d.temp_interna_max = await askNum(rl, "temp_interna_max", d.temp_interna_max ?? 8);
  d.temp_ambiente_min = await askNum(rl, "temp_ambiente_min", d.temp_ambiente_min ?? 10);
  d.temp_ambiente_max = await askNum(rl, "temp_ambiente_max", d.temp_ambiente_max ?? 35);
  d.bateria_min_pct = await askInt(rl, "bateria_min_pct", d.bateria_min_pct ?? 20);
  d.corte_red_max_seg = await askInt(rl, "corte_red_max_seg", d.corte_red_max_seg ?? 300);
  d.puerta_abierta_max_seg = await askInt(rl, "puerta_abierta_max_seg", d.puerta_abierta_max_seg ?? 120);
  d.modificable_por_responsable = await askBool(rl, "modificable_por_responsable", d.modificable_por_responsable);
}

async function pushSupabase(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  try {
    await initSupabaseThresholds(cfg, console.log);
  } catch (e) {
    console.error(e);
  }
  await ask(rl, "Enter para continuar", "");
}

async function restoreTemplate(rl: ReturnType<typeof createInterface>, cfg: LabConfig): Promise<void> {
  const ok = await askBool(rl, "¿Sobrescribir TODO el estado con default.config.json?", false);
  if (!ok) return;
  const fresh = loadLabConfig(defaultConfigPath());
  cfg.version = fresh.version;
  cfg.tenant_id = fresh.tenant_id;
  cfg.devices = fresh.devices;
  cfg.supabase_threshold_defaults = fresh.supabase_threshold_defaults;
  console.log("Restaurado desde plantilla.");
}

async function runEmulatorChild(): Promise<void> {
  console.log("\n>>> Lanzando emulador MQTT (Ctrl+C para volver al menú)…\n");
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", "@wcreation/mqtt-bridge", "lab-emulator", "--"], {
      cwd: REPO,
      stdio: "inherit",
      env,
      shell: false,
    });
    child.on("close", (code) => {
      console.log(`\n>>> Emulador terminado (código ${code ?? "?"}).\n`);
      resolve();
    });
    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  const rl = createInterface({ input, output });
  let cfg = ensureState();

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  WCreation — Laboratorio emulador (menú interactivo)    ║
║  Estado: ${STATE}
╚══════════════════════════════════════════════════════════╝`);

  let running = true;
  while (running) {
    cfg = loadLabConfig(STATE);
    console.log(`
--- Menú principal ---
  1) Listar sensores
  2) Agregar sensor
  3) Editar sensor
  4) Habilitar / deshabilitar (toggle)
  5) Eliminar sensor
  6) Editar umbrales globales Supabase (plantilla upsert)
  7) Aplicar umbrales a Supabase (solo habilitados)
  8) tenant_id del tenant MQTT
  9) Restaurar desde default.config.json
  R) Iniciar emulador MQTT (subproceso)
  S) Guardar estado en disco
  Q) Salir
`);
    const c = (await ask(rl, "Opción")).toUpperCase();
    try {
      switch (c) {
        case "1":
          printDevices(cfg);
          await ask(rl, "Enter", "");
          break;
        case "2":
          await addSensor(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "3":
          await editSensor(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "4":
          await toggleSensor(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "5":
          await deleteSensor(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "6":
          await editGlobalThresholds(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "7":
          await pushSupabase(rl, cfg);
          break;
        case "8":
          await editTenant(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "9":
          await restoreTemplate(rl, cfg);
          saveLabConfig(STATE, cfg);
          break;
        case "R":
          saveLabConfig(STATE, cfg);
          await runEmulatorChild();
          cfg = loadLabConfig(STATE);
          break;
        case "S":
          saveLabConfig(STATE, cfg);
          console.log("Guardado:", STATE);
          break;
        case "Q":
          saveLabConfig(STATE, cfg);
          running = false;
          break;
        default:
          console.log("Opción no reconocida.");
      }
    } catch (e) {
      console.error(e);
    }
  }

  rl.close();
  console.log("Chau.\n");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
