import "server-only";
import { getPool } from "@/lib/db/postgres-pool";

/**
 * Read the incremental cursor for a (source, object_type) pair. Returns
 * null on first run — callers should treat that as "pull everything".
 */
export async function getCursor(source: string, objectType: string): Promise<Date | null> {
  const sql = getPool();
  const rows = await sql<{ cursor_value: Date }[]>`
    SELECT cursor_value FROM app.ingestion_cursors
    WHERE source = ${source} AND object_type = ${objectType}
  `;
  return rows[0] ? new Date(rows[0].cursor_value) : null;
}

/**
 * Advance the cursor for (source, object_type) to `value`. Caller must
 * only call this after a successful pull — partial failures should leave
 * the cursor where it was so the next run retries the same window.
 */
export async function setCursor(
  source: string,
  objectType: string,
  value: Date,
): Promise<void> {
  const sql = getPool();
  await sql`
    INSERT INTO app.ingestion_cursors (source, object_type, cursor_value)
    VALUES (${source}, ${objectType}, ${value.toISOString()})
    ON CONFLICT (source, object_type)
    DO UPDATE SET cursor_value = EXCLUDED.cursor_value, updated_at = now()
  `;
}
