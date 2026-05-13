-- Seed de desarrollo: 1 tenant, 3 usuarios (auth + wcreation.users), 2 dispositivos.
-- Ejecutar contra la base Postgres de Supabase (rol postgres / conexión directa), después de aplicar migraciones wcreation.
-- Desde seed-dev.sh: export SUPABASE_DB_URL='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres'
-- Contraseña de los tres usuarios de prueba: WcreationDev123!
--
-- NOTA: si falla por columnas distintas según versión de GoTrue, ajustá según el esquema de tu proyecto.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $seed$
DECLARE
  inst uuid;
BEGIN
  SELECT id INTO inst FROM auth.instances LIMIT 1;
  IF inst IS NULL THEN
    RAISE EXCEPTION 'auth.instances está vacío: este archivo es solo para Supabase (local o cloud).';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new
  ) VALUES
    (
      inst,
      'b1111111-1111-1111-1111-111111111111'::uuid,
      'authenticated',
      'authenticated',
      'dev-superadmin@wcreation.local',
      crypt('WcreationDev123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      inst,
      'b2222222-2222-2222-2222-222222222222'::uuid,
      'authenticated',
      'authenticated',
      'dev-owner@wcreation.local',
      crypt('WcreationDev123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      inst,
      'b3333333-3333-3333-3333-333333333333'::uuid,
      'authenticated',
      'authenticated',
      'dev-responsable@wcreation.local',
      crypt('WcreationDev123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES
    (
      gen_random_uuid(),
      'b1111111-1111-1111-1111-111111111111'::uuid,
      jsonb_build_object(
        'sub', 'b1111111-1111-1111-1111-111111111111',
        'email', 'dev-superadmin@wcreation.local'
      ),
      'email',
      'dev-superadmin@wcreation.local',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      'b2222222-2222-2222-2222-222222222222'::uuid,
      jsonb_build_object(
        'sub', 'b2222222-2222-2222-2222-222222222222',
        'email', 'dev-owner@wcreation.local'
      ),
      'email',
      'dev-owner@wcreation.local',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      'b3333333-3333-3333-3333-333333333333'::uuid,
      jsonb_build_object(
        'sub', 'b3333333-3333-3333-3333-333333333333',
        'email', 'dev-responsable@wcreation.local'
      ),
      'email',
      'dev-responsable@wcreation.local',
      now(),
      now(),
      now()
    )
  ON CONFLICT (provider, provider_id) DO NOTHING;
END
$seed$;

INSERT INTO wcreation.tenants (id, slug, razon_social, cuit)
VALUES (
  '00000000-0000-0000-0000-0000000000aa'::uuid,
  'dev-local',
  'WCreation Farmacia Dev',
  '30-70000000-7'
)
ON CONFLICT (slug) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  cuit = EXCLUDED.cuit;

INSERT INTO wcreation.users (id, tenant_id, role_code, email, nombre, activo)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111'::uuid,
    NULL,
    'superadmin',
    'dev-superadmin@wcreation.local',
    'Dev Superadmin',
    true
  ),
  (
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '00000000-0000-0000-0000-0000000000aa'::uuid,
    'owner_admin',
    'dev-owner@wcreation.local',
    'Dev Owner',
    true
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    '00000000-0000-0000-0000-0000000000aa'::uuid,
    'responsable',
    'dev-responsable@wcreation.local',
    'Dev Responsable',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  role_code = EXCLUDED.role_code,
  email = EXCLUDED.email,
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;

INSERT INTO wcreation.devices (
  id,
  tenant_id,
  group_id,
  serial_number,
  nombre,
  estado,
  ultimo_visto
)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111'::uuid,
    '00000000-0000-0000-0000-0000000000aa'::uuid,
    NULL,
    'SN-DEV-001',
    'Heladera dev 1',
    'activo',
    now()
  ),
  (
    'a2222222-2222-2222-2222-222222222222'::uuid,
    '00000000-0000-0000-0000-0000000000aa'::uuid,
    NULL,
    'SN-DEV-002',
    'Heladera dev 2',
    'activo',
    now()
  )
ON CONFLICT (serial_number) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  estado = EXCLUDED.estado,
  ultimo_visto = EXCLUDED.ultimo_visto;

INSERT INTO wcreation.user_device_access (user_id, device_id, permiso)
VALUES
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'configurar'
  ),
  (
    'b3333333-3333-3333-3333-333333333333'::uuid,
    'a2222222-2222-2222-2222-222222222222'::uuid,
    'ver'
  )
ON CONFLICT (user_id, device_id) DO UPDATE SET permiso = EXCLUDED.permiso;

COMMIT;
