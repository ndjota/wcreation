-- VPS | 008 — Cola de notificaciones: reintentos, dead letter, idempotencia por destinatario
ALTER TABLE wcreation.notifications_queue
  ADD COLUMN IF NOT EXISTS ultimo_error text;

ALTER TABLE wcreation.notifications_queue DROP CONSTRAINT IF EXISTS notifications_queue_estado_chk;
ALTER TABLE wcreation.notifications_queue ADD CONSTRAINT notifications_queue_estado_chk CHECK (
  estado IN ('pendiente', 'enviando', 'enviado', 'error', 'dead_letter')
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_queue_dedupe_uidx
  ON wcreation.notifications_queue (evento_id, evento_ts, canal, destinatario);
