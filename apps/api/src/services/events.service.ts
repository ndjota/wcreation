import type { Pool } from "pg";
import { computeEventHash } from "@wcreation/shared/signing";

export interface EventRow {
  id: string;
  ts: string;
  device_id: string;
  tipo: string;
  severidad: string;
  payload: Record<string, unknown>;
  hash_sha256: string;
  hash_anterior: string | null;
}

export async function getLastEventHash(pool: Pool, deviceId: string): Promise<string | null> {
  const r = await pool.query(
    `SELECT hash_sha256 FROM wcreation.events WHERE device_id = $1 ORDER BY ts DESC, id DESC LIMIT 1`,
    [deviceId],
  );
  return (r.rows[0]?.hash_sha256 as string | undefined) ?? null;
}

export function signServerEvent(input: {
  payload: Record<string, unknown>;
  tsIso: string;
  deviceId: string;
  hashAnterior: string | null;
  signingKey: string;
}): string {
  return computeEventHash(input);
}

export async function listEvents(params: {
  pool: Pool;
  deviceId: string;
  from?: Date;
  to?: Date;
  tipo?: string;
  severidad?: string;
  cursorTs?: string;
  cursorId?: string;
  limit: number;
}): Promise<{ rows: EventRow[]; nextCursor: { ts: string; id: string } | null }> {
  const cond: string[] = ["device_id = $1"];
  const vals: unknown[] = [params.deviceId];
  let i = 2;
  if (params.from) {
    cond.push(`ts >= $${i++}`);
    vals.push(params.from.toISOString());
  }
  if (params.to) {
    cond.push(`ts <= $${i++}`);
    vals.push(params.to.toISOString());
  }
  if (params.tipo) {
    cond.push(`tipo = $${i++}`);
    vals.push(params.tipo);
  }
  if (params.severidad) {
    cond.push(`severidad = $${i++}`);
    vals.push(params.severidad);
  }
  if (params.cursorTs && params.cursorId) {
    cond.push(`(ts, id) < ($${i}::timestamptz, $${i + 1}::uuid)`);
    vals.push(params.cursorTs, params.cursorId);
    i += 2;
  }
  vals.push(params.limit + 1);
  const lim = `$${i}`;
  const q = `SELECT id, ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior
     FROM wcreation.events WHERE ${cond.join(" AND ")}
     ORDER BY ts DESC, id DESC LIMIT ${lim}`;
  const r = await params.pool.query(q, vals);
  const rows = r.rows as EventRow[];
  let next: { ts: string; id: string } | null = null;
  if (rows.length > params.limit) {
    const last = rows.pop()!;
    next = { ts: new Date(last.ts as unknown as string).toISOString(), id: last.id };
  }
  return { rows, nextCursor: next };
}

export async function getEventById(pool: Pool, deviceId: string, eventId: string): Promise<EventRow | null> {
  const r = await pool.query(
    `SELECT id, ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior
     FROM wcreation.events WHERE device_id = $1 AND id = $2 LIMIT 1`,
    [deviceId, eventId],
  );
  return (r.rows[0] as EventRow | undefined) ?? null;
}

export async function verifyEventChain(pool: Pool, deviceId: string, eventId: string, signingKey: string) {
  const target = await getEventById(pool, deviceId, eventId);
  if (!target) {
    return { firma_valida: false, cadena_valida: false, error: "evento_no_encontrado" as const };
  }

  const backward: EventRow[] = [];
  let cur: EventRow | null = target;
  const seen = new Set<string>();
  while (cur) {
    const k = `${cur.id}`;
    if (seen.has(k)) break;
    seen.add(k);
    backward.push(cur);
    const hashPrev: string | null = cur.hash_anterior;
    if (!hashPrev) break;
    const prevRes = (await pool.query(
      `SELECT id, ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior
       FROM wcreation.events WHERE device_id = $1 AND hash_sha256 = $2
       ORDER BY ts ASC LIMIT 1`,
      [deviceId, hashPrev],
    )) as { rows: EventRow[] };
    cur = prevRes.rows[0] ?? null;
  }

  const chronological = backward.reverse();
  let prevHash: string | null = null;
  let cadena_valida = true;
  for (const row of chronological) {
    const h = computeEventHash({
      payload: row.payload,
      tsIso: new Date(row.ts as unknown as string).toISOString(),
      deviceId,
      hashAnterior: prevHash,
      signingKey,
    });
    if (h !== row.hash_sha256) {
      cadena_valida = false;
      break;
    }
    prevHash = row.hash_sha256;
  }

  const firma_valida = computeEventHash({
    payload: target.payload,
    tsIso: new Date(target.ts as unknown as string).toISOString(),
    deviceId,
    hashAnterior: target.hash_anterior,
    signingKey,
  }) === target.hash_sha256;

  const primer = chronological[0];
  return {
    firma_valida,
    cadena_valida: cadena_valida && firma_valida,
    primer_hash: primer?.hash_sha256 ?? null,
    ultimo_hash: target.hash_sha256,
  };
}
