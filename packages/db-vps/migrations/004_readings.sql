-- VPS Timescale | 004 — Hypertable readings
CREATE TABLE IF NOT EXISTS wcreation.readings (
  ts timestamptz NOT NULL,
  device_id uuid NOT NULL REFERENCES wcreation.devices_replica (id) ON DELETE CASCADE,
  temp_interna real,
  temp_ambiente real,
  bateria_pct smallint,
  red_electrica boolean,
  puerta_abierta boolean,
  rssi_wifi smallint,
  firmware_version text,
  PRIMARY KEY (device_id, ts)
);

SELECT public.create_hypertable(
  'wcreation.readings'::regclass,
  'ts',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => true
);

ALTER TABLE wcreation.readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id'
);

SELECT public.add_compression_policy(
  'wcreation.readings'::regclass,
  INTERVAL '7 days',
  if_not_exists => true
);

SELECT public.add_retention_policy(
  'wcreation.readings'::regclass,
  INTERVAL '5 years',
  if_not_exists => true
);

CREATE INDEX IF NOT EXISTS readings_ts_brin_idx ON wcreation.readings USING brin (ts);
