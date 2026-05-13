-- wcreation | 0003 — Tablas principales
CREATE TABLE IF NOT EXISTS wcreation.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  razon_social text NOT NULL,
  cuit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wcreation.roles (
  code text PRIMARY KEY,
  jerarquia int NOT NULL UNIQUE,
  descripcion text NOT NULL
);

INSERT INTO wcreation.roles (code, jerarquia, descripcion) VALUES
  ('superadmin', 100, 'Administración global de la plataforma'),
  ('owner_admin', 80, 'Cliente dueño: gestiona su tenant completo'),
  ('responsable', 50, 'Encargado de sucursal u operación acotada'),
  ('public_viewer', 10, 'Acceso público de solo lectura vía token QR')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS wcreation.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES wcreation.tenants (id) ON DELETE SET NULL,
  role_code text NOT NULL REFERENCES wcreation.roles (code),
  email text NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_superadmin_tenant_null CHECK (
    (role_code = 'superadmin' AND tenant_id IS NULL)
    OR (role_code <> 'superadmin' AND tenant_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON wcreation.users (tenant_id);

CREATE TABLE IF NOT EXISTS wcreation.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES wcreation.tenants (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  responsable_user_id uuid REFERENCES wcreation.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_tenant_id_idx ON wcreation.groups (tenant_id);

CREATE TABLE IF NOT EXISTS wcreation.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES wcreation.tenants (id) ON DELETE CASCADE,
  group_id uuid REFERENCES wcreation.groups (id) ON DELETE SET NULL,
  serial_number text NOT NULL UNIQUE,
  nombre text NOT NULL,
  estado wcreation.estado_dispositivo NOT NULL DEFAULT 'provisionado',
  ultimo_visto timestamptz,
  ubicacion_lat double precision,
  ubicacion_lng double precision,
  ubicacion_descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_tenant_id_idx ON wcreation.devices (tenant_id);
CREATE INDEX IF NOT EXISTS devices_group_id_idx ON wcreation.devices (group_id);
