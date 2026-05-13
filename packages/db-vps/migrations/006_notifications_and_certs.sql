-- VPS Timescale | 006 — Cola de notificaciones y certificados de dispositivo en broker
CREATE TABLE IF NOT EXISTS wcreation.notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL,
  evento_ts timestamptz NOT NULL,
  canal text NOT NULL,
  destinatario text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente',
  intentos smallint NOT NULL DEFAULT 0,
  programado_para timestamptz NOT NULL DEFAULT now(),
  enviado_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_queue_canal_chk CHECK (canal IN ('email', 'push', 'telegram')),
  CONSTRAINT notifications_queue_estado_chk CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'error')),
  CONSTRAINT notifications_queue_evento_fk FOREIGN KEY (evento_id, evento_ts) REFERENCES wcreation.events (id, ts) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS notifications_queue_estado_idx ON wcreation.notifications_queue (estado, programado_para);

CREATE TABLE IF NOT EXISTS wcreation.device_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES wcreation.devices_replica (id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  fingerprint text NOT NULL UNIQUE,
  cert_pem text NOT NULL,
  common_name text NOT NULL,
  emitido_en timestamptz NOT NULL,
  expira_en timestamptz NOT NULL,
  revocado_en timestamptz,
  motivo_revocacion text
);

CREATE INDEX IF NOT EXISTS device_certificates_device_id_idx ON wcreation.device_certificates (device_id);

COMMENT ON COLUMN wcreation.events.hash_sha256 IS 'SHA-256 del canon del evento firmado con EVENT_SIGNING_KEY en la API (Etapa 3+).';
COMMENT ON COLUMN wcreation.events.hash_anterior IS 'Hash del evento previo del mismo dispositivo (cadena anti-manipulación).';
