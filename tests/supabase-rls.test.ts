import { describe, expect, it } from "vitest";
import pg from "pg";

/**
 * Verifica que todas las tablas base del esquema `wcreation` tengan RLS habilitado.
 * Requiere `SUPABASE_DB_URL` (Postgres directo al proyecto Supabase).
 */
describe("Supabase RLS en tablas wcreation", () => {
  it.skipIf(!process.env.SUPABASE_DB_URL)("todas las tablas ordinarias tienen relrowsecurity = on", async () => {
    const url = process.env.SUPABASE_DB_URL!;
    const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
    try {
      const { rows } = await pool.query<{ relname: string; relrowsecurity: boolean }>(
        `SELECT c.relname, c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'wcreation'
           AND c.relkind = 'r'
         ORDER BY c.relname`,
      );

      expect(rows.length).toBeGreaterThan(0);

      const sinRls = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
      expect(sinRls, `Tablas sin RLS: ${sinRls.join(", ")}`).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
