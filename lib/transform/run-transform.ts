import "server-only";
import { runMigrations } from "@/lib/db/migrate";
import { getPool } from "@/lib/db/postgres-pool";

// Mart refresh order matters:
//   - fact_order_lines must refresh BEFORE dim_customer because
//     fn_personal_cadence and fn_lapse_ratio query it (see migration 011
//     — it's materialised to make those function calls fast).
//   - dim_customer must refresh before the derived marts (whales,
//     lapsed, reorder_due, kpi_overview, rfm_segments, company_health)
//     since they SELECT FROM it.
//
// inventory_status was removed when Phase 1 dropped NetSuite (2026-05-13).
// ► Restoration plan: docs/netsuite-deferred.md
export const MART_VIEWS = [
  "marts.fact_order_lines",
  "marts.dim_customer",
  "marts.whales",
  "marts.lapsed",
  "marts.reorder_due",
  "marts.kpi_overview",
  "marts.rfm_segments",
  "marts.company_health",
] as const;

export type CleanupCounts = {
  ingestion_runs_deleted: number;
  api_access_log_deleted: number;
  expired_sessions_deleted: number;
  auth_audit_deleted: number;
};

export type TransformResult = {
  ok: true;
  run_id: string;
  counts: Record<string, number>;
  cleanup: CleanupCounts | null;
};

/**
 * Refresh all marts + run retention cleanup. Wraps the migration run +
 * an ingestion_runs row for telemetry. Shared between
 * /api/cron/transform (production) and scripts/test-transform.ts
 * (local one-shot from CLI).
 *
 * Throws on dim_customer being empty after refresh — that's our silent-
 * failure guard against the most likely staging join breakage.
 */
export async function runTransform(): Promise<TransformResult> {
  await runMigrations();

  const sql = getPool();
  const runRows = await sql<{ run_id: string }[]>`
    INSERT INTO app.ingestion_runs (source, status)
    VALUES ('transform', 'running')
    RETURNING run_id
  `;
  const runId = runRows[0].run_id;

  try {
    const counts: Record<string, number> = {};

    // CONCURRENTLY avoids holding an ACCESS EXCLUSIVE lock so /api/internal
    // and /api/v1 reads keep working while the refresh runs. Each mart has
    // a UNIQUE INDEX (defined in 007_marts.sql) — required for CONCURRENTLY.
    //
    // Caveat: REFRESH MATERIALIZED VIEW CONCURRENTLY fails on the FIRST
    // refresh of a never-populated mart. The error is
    // "...has not been populated". To handle this, we fall back to a
    // non-concurrent refresh on that specific error.
    for (const view of MART_VIEWS) {
      try {
        await sql.unsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("has not been populated")) {
          // First-time refresh — populate non-concurrently. Subsequent
          // refreshes can use CONCURRENTLY.
          await sql.unsafe(`REFRESH MATERIALIZED VIEW ${view}`);
        } else {
          throw e;
        }
      }
      const result = await sql.unsafe(`SELECT count(*)::int AS n FROM ${view}`);
      const firstRow = result[0] as unknown as { n: number };
      counts[view] = firstRow.n;
    }

    const cleanupRows = await sql<
      {
        ingestion_runs_deleted: bigint;
        api_access_log_deleted: bigint;
        expired_sessions_deleted: bigint;
        auth_audit_deleted: bigint;
      }[]
    >`SELECT * FROM app.fn_retention_cleanup()`;
    const cleanup = serialiseCleanup(cleanupRows[0]);

    // Silent-failure guard: a mart with zero rows when raw data exists
    // is a sign the view definition is wrong (broken WHERE clause,
    // missing join key, etc.).
    if (counts["marts.dim_customer"] === 0) {
      throw new Error(
        "marts.dim_customer is empty after refresh — staging joins likely broken. " +
          "Check Phase 0 deal stage filter (default 'closedwon'), association tables " +
          "(raw_hubspot.assoc_deal_company), and that ingestion has actually run.",
      );
    }

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    await sql`
      UPDATE app.ingestion_runs
      SET status = 'success', finished_at = now(), rows_ingested = ${total},
          errors = ${JSON.stringify({ counts, cleanup })}
      WHERE run_id = ${runId}
    `;

    return { ok: true, run_id: runId, counts, cleanup };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sql`
      UPDATE app.ingestion_runs
      SET status = 'failed', finished_at = now(),
          errors = ${JSON.stringify({ message })}
      WHERE run_id = ${runId}
    `;
    throw e;
  }
}

function serialiseCleanup(c?: {
  ingestion_runs_deleted: bigint;
  api_access_log_deleted: bigint;
  expired_sessions_deleted: bigint;
  auth_audit_deleted: bigint;
}): CleanupCounts | null {
  if (!c) return null;
  return {
    ingestion_runs_deleted: Number(c.ingestion_runs_deleted),
    api_access_log_deleted: Number(c.api_access_log_deleted),
    expired_sessions_deleted: Number(c.expired_sessions_deleted),
    auth_audit_deleted: Number(c.auth_audit_deleted),
  };
}
