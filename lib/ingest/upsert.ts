import "server-only";
import { getPool } from "@/lib/db/postgres-pool";

const HUBSPOT_TABLES = new Set([
  "companies",
  "deals",
  "line_items",
  "contacts",
  "engagements",
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
  // postgres.js doesn't auto-stringify objects for jsonb columns, so we
  // serialize the payload explicitly. Tuples are typed as
  // (string | number)[][] which the postgres.js helper accepts.
  const tuples: (string | number)[][] = rows.map((r) => [
    r.hs_object_id,
    r.hs_lastmodified,
    JSON.stringify(r.payload),
  ]);

  // Table name is templated through sql() which validates against the
  // identifier syntax — combined with the HUBSPOT_TABLES allowlist above,
  // safe from injection. ON CONFLICT DO NOTHING makes re-ingest cheap;
  // only previously-unseen (id, modified) pairs insert.
  const result = await sql`
    INSERT INTO raw_hubspot.${sql(table)} (hs_object_id, hs_lastmodified, payload)
    VALUES ${sql(tuples)}
    ON CONFLICT (hs_object_id, hs_lastmodified) DO NOTHING
  `;
  return result.count;
}
