/**
 * Carga datos demo en Supabase Cloud.
 * - Auth: Admin API (no depende del esquema `wcreation` en Data API / PostgREST).
 * - Tablas `wcreation.*`: `supabase db query --linked` (Postgres directo; evita PGRST106).
 *
 * Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, proyecto vinculado (`supabase link`),
 * SEED_SUPERADMIN_EMAIL, y opcionalmente SEED_OWNER_EMAIL, SEED_RESP_*_EMAIL, SEED_USER_PASSWORD.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

/** Mismo tenant que `seed-dev.sh`, `.env` (`WCREATION_TENANT_ID`) y tópicos MQTT. */
const TENANT_ID = "00000000-0000-0000-0000-0000000000aa";
const GROUP_CENTRO = "b0000000-0000-0000-0000-000000000011";
const GROUP_NORTE = "b0000000-0000-0000-0000-000000000012";
const DEVICE_1 = "a1111111-1111-1111-1111-111111111111";
const DEVICE_2 = "a2222222-2222-2222-2222-222222222222";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno ${name}`);
  return v;
}

function sqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function runLinkedSql(sql: string): void {
  const dir = mkdtempSync(join(tmpdir(), "wcreation-seed-"));
  const file = join(dir, "seed.sql");
  try {
    writeFileSync(file, sql, "utf8");
    execFileSync("supabase", ["db", "query", "--linked", "-f", file], {
      cwd: repoRoot(),
      stdio: "inherit",
      env: process.env,
    });
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function buildSeedSql(params: {
  superId: string;
  ownerId: string;
  r1Id: string;
  r2Id: string;
  superEmail: string;
  ownerEmail: string;
  resp1: string;
  resp2: string;
}): string {
  const { superId, ownerId, r1Id, r2Id, superEmail, ownerEmail, resp1, resp2 } = params;
  const L = sqlLiteral;
  return `BEGIN;

INSERT INTO wcreation.tenants (id, slug, razon_social, cuit)
VALUES (
  '${TENANT_ID}'::uuid,
  'dev-local',
  '${L("WCreation Farmacia Dev")}',
  '${L("30-70000000-7")}'
)
ON CONFLICT (slug) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  cuit = EXCLUDED.cuit,
  updated_at = now();

INSERT INTO wcreation.users (id, tenant_id, role_code, email, nombre, activo) VALUES
  ('${superId}'::uuid, NULL, 'superadmin', '${L(superEmail)}', '${L("Super Admin")}', true),
  ('${ownerId}'::uuid, '${TENANT_ID}'::uuid, 'owner_admin', '${L(ownerEmail)}', '${L("Dueño Demo")}', true),
  ('${r1Id}'::uuid, '${TENANT_ID}'::uuid, 'responsable', '${L(resp1)}', '${L("Responsable Centro")}', true),
  ('${r2Id}'::uuid, '${TENANT_ID}'::uuid, 'responsable', '${L(resp2)}', '${L("Responsable Norte")}', true)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  role_code = EXCLUDED.role_code,
  email = EXCLUDED.email,
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo,
  updated_at = now();

INSERT INTO wcreation.groups (id, tenant_id, nombre, responsable_user_id) VALUES
  ('${GROUP_CENTRO}'::uuid, '${TENANT_ID}'::uuid, '${L("Sucursal Centro")}', '${r1Id}'::uuid),
  ('${GROUP_NORTE}'::uuid, '${TENANT_ID}'::uuid, '${L("Sucursal Norte")}', '${r2Id}'::uuid)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  nombre = EXCLUDED.nombre,
  responsable_user_id = EXCLUDED.responsable_user_id,
  updated_at = now();

INSERT INTO wcreation.devices (id, tenant_id, group_id, serial_number, nombre, estado) VALUES
  (
    '${DEVICE_1}'::uuid,
    '${TENANT_ID}'::uuid,
    '${GROUP_CENTRO}'::uuid,
    '${L("SN-DEV-001")}',
    '${L("Heladera Centro 1")}',
    'activo'::wcreation.estado_dispositivo
  ),
  (
    '${DEVICE_2}'::uuid,
    '${TENANT_ID}'::uuid,
    '${GROUP_NORTE}'::uuid,
    '${L("SN-DEV-002")}',
    '${L("Cámara Norte 1")}',
    'activo'::wcreation.estado_dispositivo
  )
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  group_id = EXCLUDED.group_id,
  serial_number = EXCLUDED.serial_number,
  nombre = EXCLUDED.nombre,
  estado = EXCLUDED.estado,
  updated_at = now();

INSERT INTO wcreation.device_thresholds (
  device_id,
  temp_interna_min,
  temp_interna_max,
  temp_ambiente_min,
  temp_ambiente_max,
  bateria_min_pct,
  corte_red_max_seg,
  puerta_abierta_max_seg,
  modificable_por_responsable
) VALUES
  (
    '${DEVICE_1}'::uuid,
    2,
    8,
    NULL,
    35,
    15,
    300,
    120,
    true
  ),
  (
    '${DEVICE_2}'::uuid,
    2,
    8,
    NULL,
    NULL,
    20,
    300,
    90,
    false
  )
ON CONFLICT (device_id) DO UPDATE SET
  temp_interna_min = EXCLUDED.temp_interna_min,
  temp_interna_max = EXCLUDED.temp_interna_max,
  temp_ambiente_min = EXCLUDED.temp_ambiente_min,
  temp_ambiente_max = EXCLUDED.temp_ambiente_max,
  bateria_min_pct = EXCLUDED.bateria_min_pct,
  corte_red_max_seg = EXCLUDED.corte_red_max_seg,
  puerta_abierta_max_seg = EXCLUDED.puerta_abierta_max_seg,
  modificable_por_responsable = EXCLUDED.modificable_por_responsable,
  updated_at = now();

INSERT INTO wcreation.user_device_access (user_id, device_id, permiso) VALUES
  ('${r1Id}'::uuid, '${DEVICE_1}'::uuid, 'configurar'::wcreation.user_device_permiso),
  ('${r2Id}'::uuid, '${DEVICE_2}'::uuid, 'ver'::wcreation.user_device_permiso)
ON CONFLICT (user_id, device_id) DO UPDATE SET
  permiso = EXCLUDED.permiso,
  updated_at = now();

INSERT INTO wcreation.public_qr_tokens (id, device_id, token_publico, activo) VALUES
  (
    'c0000000-0000-0000-0000-0000000000c1'::uuid,
    '${DEVICE_1}'::uuid,
    '${L("demo-public-token-wc")}',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  device_id = EXCLUDED.device_id,
  token_publico = EXCLUDED.token_publico,
  activo = EXCLUDED.activo,
  updated_at = now();

COMMIT;
`;
}

async function getOrCreateAuthUser(
  sb: ReturnType<typeof createClient>,
  email: string,
  password: string,
): Promise<string> {
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < perPage) break;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error(`No se creó usuario ${email}`);
  return data.user.id;
}

async function main(): Promise<void> {
  const url = req("SUPABASE_URL");
  const service = req("SUPABASE_SERVICE_ROLE_KEY");
  const superEmail = req("SEED_SUPERADMIN_EMAIL");
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner-demo@wcreation.local";
  const resp1 = process.env.SEED_RESP_1_EMAIL ?? "resp1-demo@wcreation.local";
  const resp2 = process.env.SEED_RESP_2_EMAIL ?? "resp2-demo@wcreation.local";
  const password = process.env.SEED_USER_PASSWORD ?? "WcreationDev123!";

  const sb = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const superId = await getOrCreateAuthUser(sb, superEmail, password);
  const ownerId = await getOrCreateAuthUser(sb, ownerEmail, password);
  const r1Id = await getOrCreateAuthUser(sb, resp1, password);
  const r2Id = await getOrCreateAuthUser(sb, resp2, password);

  try {
    runLinkedSql(
      buildSeedSql({
        superId,
        ownerId,
        r1Id,
        r2Id,
        superEmail,
        ownerEmail,
        resp1,
        resp2,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      "\nFalló `supabase db query --linked` (datos wcreation). ¿Proyecto vinculado? `supabase link --project-ref …`\n" +
        "Si no usás CLI, alternativa: exponer el esquema `wcreation` en Dashboard → API → Data API.\n",
    );
    throw new Error(msg, { cause: e });
  }

  console.log("Seed Supabase OK. Usuarios:", { superEmail, ownerEmail, resp1, resp2 });
  console.log("Contraseña común (SEED_USER_PASSWORD):", password);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
