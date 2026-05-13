/**
 * Carga datos demo en Supabase Cloud (service role).
 * Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_SUPERADMIN_EMAIL, SEED_USER_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";

const TENANT_ID = "b0000000-0000-0000-0000-000000000001";
const GROUP_CENTRO = "b0000000-0000-0000-0000-000000000011";
const GROUP_NORTE = "b0000000-0000-0000-0000-000000000012";
const DEVICE_1 = "a1111111-1111-1111-1111-111111111111";
const DEVICE_2 = "a2222222-2222-2222-2222-222222222222";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno ${name}`);
  return v;
}

async function createAuthUser(
  sb: ReturnType<typeof createClient>,
  email: string,
  password: string,
): Promise<string> {
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

  const superId = await createAuthUser(sb, superEmail, password);
  const ownerId = await createAuthUser(sb, ownerEmail, password);
  const r1Id = await createAuthUser(sb, resp1, password);
  const r2Id = await createAuthUser(sb, resp2, password);

  const { error: eTenant } = await sb
    .schema("wcreation")
    .from("tenants")
    .upsert(
      {
        id: TENANT_ID,
        slug: "farmacia-demo",
        razon_social: "Farmacia Demo S.A.",
        cuit: "30-12345678-9",
      },
      { onConflict: "slug" },
    );
  if (eTenant) throw eTenant;

  const usersRows = [
    { id: superId, tenant_id: null, role_code: "superadmin", email: superEmail, nombre: "Super Admin", activo: true },
    {
      id: ownerId,
      tenant_id: TENANT_ID,
      role_code: "owner_admin",
      email: ownerEmail,
      nombre: "Dueño Demo",
      activo: true,
    },
    {
      id: r1Id,
      tenant_id: TENANT_ID,
      role_code: "responsable",
      email: resp1,
      nombre: "Responsable Centro",
      activo: true,
    },
    {
      id: r2Id,
      tenant_id: TENANT_ID,
      role_code: "responsable",
      email: resp2,
      nombre: "Responsable Norte",
      activo: true,
    },
  ];

  const { error: eUsers } = await sb.schema("wcreation").from("users").upsert(usersRows, { onConflict: "id" });
  if (eUsers) throw eUsers;

  const { error: eG1 } = await sb
    .schema("wcreation")
    .from("groups")
    .upsert(
      [
        { id: GROUP_CENTRO, tenant_id: TENANT_ID, nombre: "Sucursal Centro", responsable_user_id: r1Id },
        { id: GROUP_NORTE, tenant_id: TENANT_ID, nombre: "Sucursal Norte", responsable_user_id: r2Id },
      ],
      { onConflict: "id" },
    );
  if (eG1) throw eG1;

  const { error: eDev } = await sb
    .schema("wcreation")
    .from("devices")
    .upsert(
      [
        {
          id: DEVICE_1,
          tenant_id: TENANT_ID,
          group_id: GROUP_CENTRO,
          serial_number: "SN-DEV-001",
          nombre: "Heladera Centro 1",
          estado: "activo",
        },
        {
          id: DEVICE_2,
          tenant_id: TENANT_ID,
          group_id: GROUP_NORTE,
          serial_number: "SN-DEV-002",
          nombre: "Cámara Norte 1",
          estado: "activo",
        },
      ],
      { onConflict: "id" },
    );
  if (eDev) throw eDev;

  const { error: eTh } = await sb
    .schema("wcreation")
    .from("device_thresholds")
    .upsert(
      [
        {
          device_id: DEVICE_1,
          temp_interna_min: 2,
          temp_interna_max: 8,
          temp_ambiente_min: null,
          temp_ambiente_max: 35,
          bateria_min_pct: 15,
          corte_red_max_seg: 300,
          puerta_abierta_max_seg: 120,
          modificable_por_responsable: true,
        },
        {
          device_id: DEVICE_2,
          temp_interna_min: 2,
          temp_interna_max: 8,
          bateria_min_pct: 20,
          corte_red_max_seg: 300,
          puerta_abierta_max_seg: 90,
          modificable_por_responsable: false,
        },
      ],
      { onConflict: "device_id" },
    );
  if (eTh) throw eTh;

  const { error: eAcc } = await sb.schema("wcreation").from("user_device_access").upsert(
    [
      { user_id: r1Id, device_id: DEVICE_1, permiso: "configurar" },
      { user_id: r2Id, device_id: DEVICE_2, permiso: "ver" },
    ],
    { onConflict: "user_id,device_id" },
  );
  if (eAcc) throw eAcc;

  const { error: eQr } = await sb.schema("wcreation").from("public_qr_tokens").upsert(
    {
      id: "c0000000-0000-0000-0000-0000000000c1",
      device_id: DEVICE_1,
      token_publico: "demo-public-token-wc",
      activo: true,
    },
    { onConflict: "id" },
  );
  if (eQr) throw eQr;

  console.log("Seed Supabase OK. Usuarios:", { superEmail, ownerEmail, resp1, resp2 });
  console.log("Contraseña común (SEED_USER_PASSWORD):", password);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
