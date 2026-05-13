import type { Pool } from "pg";

const intervalMap: Record<string, string> = {
  raw: "",
  "1m": "1 minute",
  "5m": "5 minutes",
  "1h": "1 hour",
  "1d": "1 day",
};

export async function queryReadings(params: {
  pool: Pool;
  deviceId: string;
  from: Date;
  to: Date;
  interval: string;
}): Promise<
  Array<{
    ts: string;
    temp_interna: number | null;
    temp_ambiente: number | null;
    bateria_pct: number | null;
    red_electrica: boolean | null;
    puerta_abierta: boolean | null;
    rssi_wifi: number | null;
    firmware_version: string | null;
  }>
> {
  const mapped = intervalMap[params.interval];
  if (params.interval === "raw" || mapped === undefined || mapped === "") {
    const r = await params.pool.query(
      `SELECT ts, temp_interna, temp_ambiente, bateria_pct, red_electrica, puerta_abierta, rssi_wifi, firmware_version
       FROM wcreation.readings
       WHERE device_id = $1 AND ts >= $2 AND ts <= $3
       ORDER BY ts ASC`,
      [params.deviceId, params.from.toISOString(), params.to.toISOString()],
    );
    return r.rows as typeof r.rows;
  }
  const r = await params.pool.query(
    `SELECT time_bucket($1::interval, ts) AS ts,
            avg(temp_interna)::real AS temp_interna,
            avg(temp_ambiente)::real AS temp_ambiente,
            avg(bateria_pct)::smallint AS bateria_pct,
            bool_or(red_electrica) AS red_electrica,
            bool_or(puerta_abierta) AS puerta_abierta,
            avg(rssi_wifi)::smallint AS rssi_wifi,
            max(firmware_version) AS firmware_version
     FROM wcreation.readings
     WHERE device_id = $2 AND ts >= $3 AND ts <= $4
     GROUP BY 1
     ORDER BY 1 ASC`,
    [mapped, params.deviceId, params.from.toISOString(), params.to.toISOString()],
  );
  return r.rows.map((row) => ({
    ts: (row.ts as Date).toISOString(),
    temp_interna: row.temp_interna as number | null,
    temp_ambiente: row.temp_ambiente as number | null,
    bateria_pct: row.bateria_pct as number | null,
    red_electrica: row.red_electrica as boolean | null,
    puerta_abierta: row.puerta_abierta as boolean | null,
    rssi_wifi: row.rssi_wifi as number | null,
    firmware_version: row.firmware_version as string | null,
  }));
}
