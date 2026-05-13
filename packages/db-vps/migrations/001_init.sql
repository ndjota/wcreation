-- VPS Timescale | 001 — Esquema y libro de migraciones
CREATE SCHEMA IF NOT EXISTS wcreation;

CREATE TABLE IF NOT EXISTS wcreation.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON SCHEMA wcreation IS 'Serie temporal y colas en VPS (sin RLS; solo backend).';
