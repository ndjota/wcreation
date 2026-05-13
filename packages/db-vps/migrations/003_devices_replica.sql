-- VPS Timescale | 003 — Réplica mínima de dispositivos (sincronizada desde Supabase)
CREATE TABLE IF NOT EXISTS wcreation.devices_replica (
  id uuid PRIMARY KEY,
  serial_number text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  sincronizado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_replica_tenant_id_idx ON wcreation.devices_replica (tenant_id);

COMMENT ON TABLE wcreation.devices_replica IS 'Copia operativa de dispositivos; la fuente de verdad sigue en Supabase.';
