-- VPS Timescale | 005 — Hypertable events (cadena de integridad con hash encadenado)
CREATE TABLE IF NOT EXISTS wcreation.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL,
  device_id uuid NOT NULL REFERENCES wcreation.devices_replica (id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidad text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash_sha256 text NOT NULL,
  hash_anterior text,
  PRIMARY KEY (device_id, ts, id),
  CONSTRAINT events_tipo_chk CHECK (
    tipo IN (
      'umbral_excedido_temp',
      'corte_red',
      'puerta_prolongada',
      'bateria_baja',
      'dispositivo_offline',
      'configuracion_modificada',
      'cadena_frio_perdida'
    )
  ),
  CONSTRAINT events_severidad_chk CHECK (severidad IN ('info', 'warning', 'critical'))
);

SELECT public.create_hypertable('wcreation.events'::regclass, 'ts', if_not_exists => true);

CREATE UNIQUE INDEX IF NOT EXISTS events_id_ts_uidx ON wcreation.events (id, ts);

CREATE INDEX IF NOT EXISTS events_tipo_ts_idx ON wcreation.events (tipo, ts DESC);

ALTER TABLE wcreation.events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id',
  timescaledb.compress_orderby = 'ts DESC, id DESC'
);

SELECT public.add_compression_policy(
  'wcreation.events'::regclass,
  INTERVAL '7 days',
  if_not_exists => true
);

SELECT public.add_retention_policy(
  'wcreation.events'::regclass,
  INTERVAL '5 years',
  if_not_exists => true
);
