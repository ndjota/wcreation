import type { Pool } from "pg";
import { computeEventHash } from "@wcreation/shared/signing";

export async function verifyDeviceLastChain(
  pool: Pool,
  deviceId: string,
  signingKey: string,
): Promise<{
  firma_valida: boolean;
  cadena_valida: boolean;
  primer_hash: string | null;
  ultimo_hash: string;
  error?: string;
}> {
  const last = await pool.query(
    `SELECT id, ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior
     FROM wcreation.events WHERE device_id = $1::uuid ORDER BY ts DESC, id DESC LIMIT 1`,
    [deviceId],
  );
  const target = last.rows[0] as
    | {
        id: string;
        ts: Date;
        device_id: string;
        tipo: string;
        severidad: string;
        payload: Record<string, unknown>;
        hash_sha256: string;
        hash_anterior: string | null;
      }
    | undefined;
  if (!target) {
    return { firma_valida: false, cadena_valida: false, primer_hash: null, ultimo_hash: "", error: "sin_eventos" };
  }

  const backward: {
    id: string;
    ts: Date;
    device_id: string;
    tipo: string;
    severidad: string;
    payload: Record<string, unknown>;
    hash_sha256: string;
    hash_anterior: string | null;
  }[] = [];
  type Row = (typeof backward)[number];

  async function fetchPrev(hashAnterior: string): Promise<Row | null> {
    const res = await pool.query(
      `SELECT id, ts, device_id, tipo, severidad, payload, hash_sha256, hash_anterior
       FROM wcreation.events WHERE device_id = $1::uuid AND hash_sha256 = $2
       ORDER BY ts ASC LIMIT 1`,
      [deviceId, hashAnterior],
    );
    return (res.rows[0] as Row | undefined) ?? null;
  }

  let cur: Row | null = target;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    backward.push(cur);
    if (!cur.hash_anterior) break;
    cur = await fetchPrev(cur.hash_anterior);
  }

  const chronological = backward.reverse();
  let prevHash: string | null = null;
  let cadena_valida = true;
  for (const row of chronological) {
    const h = computeEventHash({
      payload: row.payload,
      tsIso: new Date(row.ts).toISOString(),
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

  const firma_valida =
    computeEventHash({
      payload: target.payload,
      tsIso: new Date(target.ts).toISOString(),
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
