// Idempotent migration runner. Safe to call on every cron invocation —
// the bootstrap pattern (CREATE SCHEMA + tracking table inline) means a
// fresh database initialises cleanly, and CREATE TABLE IF NOT EXISTS
// makes re-runs a no-op.
//
// Imported by both Next.js cron routes AND the standalone `pnpm db:migrate`
// script (which runs via tsx, not through Next.js's bundler). The
// `import "server-only"` guard is intentionally NOT used here — it would
// throw inside tsx. The other imports (node:fs, node:path, postgres) are
// already client-incompatible, so client-side import accidents fail loud
// without it.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function runMigrations(): Promise<{ applied: string[] }> {
  // Accept both naming conventions — see lib/db/postgres-pool.ts for rationale.
  // Prefer unpooled for DDL: pooled URLs have shorter statement timeouts.
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Expected one of: " +
        "DATABASE_URL_UNPOOLED, DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL. " +
        "Provision Neon via Vercel Marketplace, then run `vercel env pull --environment=production .env.local`.",
    );
  }

  // Use a one-shot client — migrations are infrequent and we want a clean
  // close so the function returns promptly.
  const sql = postgres(url, { max: 1 });

  try {
    // Bootstrap: the `app` schema must exist before app.migrations can be
    // created. The first migration file (001_schemas.sql) re-creates the
    // schema as a no-op via IF NOT EXISTS.
    await sql`CREATE SCHEMA IF NOT EXISTS app`;
    await sql`
      CREATE TABLE IF NOT EXISTS app.migrations (
        id text PRIMARY KEY,
        applied_at timestamptz DEFAULT now()
      )
    `;

    const dir = join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const applied: string[] = [];
    for (const file of files) {
      const id = file.replace(".sql", "");
      const existing = await sql`SELECT id FROM app.migrations WHERE id = ${id}`;
      if (existing.length > 0) continue;
      const content = readFileSync(join(dir, file), "utf8");
      await sql.unsafe(content);
      await sql`INSERT INTO app.migrations (id) VALUES (${id})`;
      applied.push(id);
    }

    return { applied };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
