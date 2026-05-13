import "server-only";
import { getPool } from "@/lib/db/postgres-pool";

const HUBSPOT_TABLES = new Set([
  "companies",
  "deals",
  "line_items",
  "contacts",
  "engagements",
  "orders",
]);

type HubSpotRow = {
  hs_object_id: number;
  hs_lastmodified: string;
  payload: object;
};

/**
 * Idempotent bulk upsert into raw_hubspot.<table>. Returns the number of
 * rows inserted (excluding ON CONFLICT skips). Vercel cron may very
 * occasionally double-deliver; this stays correct under that.
 *
 * Caller passes only HubSpot tables — the allowlist guards against the
 * `sql.unsafe`-equivalent risk of templating a table name from input.
 */
export async function upsertHubSpotObject(
  table: string,
  rows: HubSpotRow[],
): Promise<number> {
  if (!HUBSPOT_TABLES.has(table)) {
    throw new Error(`upsertHubSpotObject: unknown table '${table}'`);
  }
  if (rows.length === 0) return 0;

  const sql = getPool();
  // Three parallel arrays driven through UNNEST + per-row cast. Why this
  // exact pattern (text[] + cast each element in SELECT, NOT jsonb[] at
  // the array level): postgres.js encodes string-array parameters for the
  // wire protocol with extra escaping, and applying `::jsonb[]` at array
  // level then stores each element as a jsonb STRING value rather than
  // parsing it as a jsonb OBJECT. Casting `p::jsonb` per row in the
  // outer SELECT bypasses the array-level encoding and correctly parses
  // each element as JSON. (Verified empirically in
  // scripts/test-jsonb-insert.ts — pattern D vs pattern C.)
  const ids = rows.map((r) => r.hs_object_id);
  const mods = rows.map((r) => r.hs_lastmodified);
  const payloads = rows.map((r) => JSON.stringify(r.payload));

  // Table name is templated through sql() which validates against the
  // identifier syntax — combined with the HUBSPOT_TABLES allowlist above,
  // safe from injection. ON CONFLICT DO NOTHING makes re-ingest cheap;
  // only previously-unseen (id, modified) pairs insert.
  const result = await sql`
    INSERT INTO raw_hubspot.${sql(table)} (hs_object_id, hs_lastmodified, payload)
    SELECT id, modified, p::jsonb FROM unnest(
      ${ids}::bigint[],
      ${mods}::timestamptz[],
      ${payloads}::text[]
    ) AS t(id, modified, p)
    ON CONFLICT (hs_object_id, hs_lastmodified) DO NOTHING
  `;
  return result.count;
}
