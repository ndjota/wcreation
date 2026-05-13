import type { Pool } from "pg";
import { computeEventHash } from "@wcreation/shared/signing";

export async function getLastEventHash(pool: Pool, deviceId: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT hash_sha256 FROM wcreation.events WHERE device_id = $1 ORDER BY ts DESC, id DESC LIMIT 1`,
    [deviceId],
  );
  return (r.rows[0]?.hash_sha256 as string | undefined) ?? null;
}

export async function insertSignedEvent(params: {
  pool: Pool;
  deviceId: string;
  tipo: string;
  severidad: string;
  payload: Record<string, unknown>;
  signingKey: string;
}): Promise<{ id: string; ts: string }> {
  const tsIso = new Date().toISOString();
  const hashAnterior = await getLastEventHash(params.pool, params.deviceId);
  const hash = computeEventHash({
    payload: params.payload,
    tsIso,
    deviceId: params.deviceId,
    hashAnterior,
    signingKey: params.signingKey,
  });
  const ins = await params.pool.query(
    `INSERT INTO wcreation.events (ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior)
     VALUES ($1::timestamptz, $2::uuid, $3, $4, $5::jsonb, $6, $7)
     RETURNING id, ts`,
    [tsIso, params.deviceId, params.tipo, params.severidad, JSON.stringify(params.payload), hash, hashAnterior],
  );
  const row = ins.rows[0] as { id: string; ts: Date };
  return { id: row.id, ts: row.ts.toISOString() };
}
