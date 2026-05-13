-- VPS Timescale | 007 — Vista materializada de último estado + job de refresco
CREATE MATERIALIZED VIEW IF NOT EXISTS wcreation.device_last_state AS
SELECT
  r.device_id,
  r.ts AS last_reading_ts,
  r.temp_interna AS last_temp_interna,
  r.temp_ambiente AS last_temp_ambiente,
  r.bateria_pct AS last_bateria_pct,
  r.red_electrica AS last_red_electrica,
  r.puerta_abierta AS last_puerta_abierta,
  r.rssi_wifi AS last_rssi_wifi,
  r.firmware_version AS last_firmware_version,
  COALESCE(ec.critical_events, '[]'::jsonb) AS ultimos_eventos_criticos
FROM (
  SELECT DISTINCT ON (device_id)
    device_id,
    ts,
    temp_interna,
    temp_ambiente,
    bateria_pct,
    red_electrica,
    puerta_abierta,
    rssi_wifi,
    firmware_version
  FROM wcreation.readings
  ORDER BY device_id, ts DESC
) r
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'ts', e.ts,
        'tipo', e.tipo,
        'severidad', e.severidad,
        'payload', e.payload
      )
      ORDER BY e.ts DESC
    ),
    '[]'::jsonb
  ) AS critical_events
  FROM (
    SELECT id, ts, tipo, severidad, payload
    FROM wcreation.events
    WHERE device_id = r.device_id
      AND severidad = 'critical'
    ORDER BY ts DESC
    LIMIT 10
  ) e
) ec ON true;

CREATE UNIQUE INDEX IF NOT EXISTS device_last_state_device_uidx
  ON wcreation.device_last_state (device_id);

REFRESH MATERIALIZED VIEW wcreation.device_last_state;

CREATE OR REPLACE PROCEDURE wcreation.job_refresh_device_last_state (job_id integer, config jsonb)
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY wcreation.device_last_state;
END;
$$;

SELECT public.add_job(
  proc => 'wcreation.job_refresh_device_last_state'::regproc,
  schedule_interval => interval '1 minute',
  config => '{}'::jsonb
);

COMMENT ON MATERIALIZED VIEW wcreation.device_last_state IS 'Último reading y últimos eventos críticos por dispositivo; refresco programado cada 1 minuto.';
