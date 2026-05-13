-- wcreation | 0010 — Telegram linkeo, pausa global de alertas, reportes cadena de frío

ALTER TABLE wcreation.users
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS notifications_paused boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS wcreation.telegram_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES wcreation.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_expires_idx ON wcreation.telegram_link_tokens (expires_at);

ALTER TABLE wcreation.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_link_tokens_no_client ON wcreation.telegram_link_tokens;
CREATE POLICY telegram_link_tokens_no_client ON wcreation.telegram_link_tokens
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS wcreation.cold_chain_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES wcreation.devices (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES wcreation.tenants (id) ON DELETE CASCADE,
  period_from timestamptz NOT NULL,
  period_to timestamptz NOT NULL,
  format text NOT NULL CHECK (format IN ('pdf', 'csv')),
  storage_path text,
  pdf_sha256 text,
  report_signature text,
  created_by_user_id uuid REFERENCES wcreation.users (id) ON DELETE SET NULL,
  is_public_qr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cold_chain_reports_device_idx ON wcreation.cold_chain_reports (device_id, created_at DESC);

ALTER TABLE wcreation.cold_chain_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cold_chain_reports_select_scope ON wcreation.cold_chain_reports;
CREATE POLICY cold_chain_reports_select_scope ON wcreation.cold_chain_reports
  FOR SELECT TO authenticated USING (
    wcreation.is_superadmin()
    OR (
      tenant_id = wcreation.current_tenant_id()
      AND (
        wcreation.current_role_code() = 'owner_admin'
        OR (
          wcreation.current_role_code() = 'responsable'
          AND EXISTS (
            SELECT 1 FROM wcreation.user_device_access uda
            WHERE uda.user_id = auth.uid() AND uda.device_id = cold_chain_reports.device_id
          )
        )
      )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cold-chain-reports',
  'cold-chain-reports',
  false,
  52428800,
  ARRAY['application/pdf', 'text/csv']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Subidas y URLs firmadas se gestionan con la service role del API (sin políticas RLS adicionales aquí).
