import { runMigrations } from "@/lib/db/migrate";
import { getPool } from "@/lib/db/postgres-pool";

export const runtime = "nodejs";
export const maxDuration = 300;

// Mart refresh order matters: dim_customer must refresh before the
// derived marts (whales, lapsed, reorder_due, kpi_overview,
// rfm_segments, company_health) since they SELECT FROM it.
// inventory_status is independent.
const MART_VIEWS = [
  "marts.dim_customer",
  "marts.whales",
  "marts.lapsed",
  "marts.reorder_due",
  "marts.kpi_overview",
  "marts.rfm_segments",
  "marts.company_health",
  "marts.inventory_status",
] as const;

export async function GET(req: Request) {
  // Auth required everywhere — see master plan §13.5.
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

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
    for (const view of MART_VIEWS) {
      await sql.unsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      // Row count after refresh. Silent-failure guard: a mart with zero
      // rows when raw data exists is a sign the view definition is wrong
      // (broken WHERE clause, missing join key, etc.). We surface the
      // counts in the run record so they're visible in app.ingestion_runs
      // without needing to query each mart manually.
      const result = await sql.unsafe(`SELECT count(*)::int AS n FROM ${view}`);
      const firstRow = result[0] as unknown as { n: number };
      counts[view] = firstRow.n;
    }

    // Retention cleanup folded in (no separate cron). 90d for
    // app.ingestion_runs + app.api_access_log; 180d for inventory snapshots.
    const cleanupRows = await sql<
      {
        ingestion_runs_deleted: bigint;
        api_access_log_deleted: bigint;
        inventory_snapshots_deleted: bigint;
      }[]
    >`SELECT * FROM app.fn_retention_cleanup()`;
    const cleanup = cleanupRows[0];

    // Fail loudly if dim_customer is empty — that means staging joins
    // produced nothing and every downstream mart is also empty. Likely
    // causes: deal stage filter wrong (Phase 0 §A1), associations not
    // pulled (deal_id missing in raw_hubspot.assoc_deal_company), or
    // ingestion never ran.
    if (counts["marts.dim_customer"] === 0) {
      throw new Error(
        "marts.dim_customer is empty after refresh — staging joins likely broken. " +
          "Check Phase 0 deal stage filter, association tables, and recent ingestion runs.",
      );
    }

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    await sql`
      UPDATE app.ingestion_runs
      SET status = 'success', finished_at = now(), rows_ingested = ${total},
          errors = ${JSON.stringify({ counts, cleanup: serialiseCleanup(cleanup) })}
      WHERE run_id = ${runId}
    `;

    return Response.json({
      ok: true,
      run_id: runId,
      counts,
      cleanup: serialiseCleanup(cleanup),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sql`
      UPDATE app.ingestion_runs
      SET status = 'failed', finished_at = now(),
          errors = ${JSON.stringify({ message })}
      WHERE run_id = ${runId}
    `;
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

function serialiseCleanup(c?: {
  ingestion_runs_deleted: bigint;
  api_access_log_deleted: bigint;
  inventory_snapshots_deleted: bigint;
}) {
  if (!c) return null;
  return {
    ingestion_runs_deleted: Number(c.ingestion_runs_deleted),
    api_access_log_deleted: Number(c.api_access_log_deleted),
    inventory_snapshots_deleted: Number(c.inventory_snapshots_deleted),
  };
}
