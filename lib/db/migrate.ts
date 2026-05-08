// Idempotent migration runner. Safe to call on every cron invocation —
// the bootstrap pattern (CREATE SCHEMA + tracking table inline) means a
// fresh database initialises cleanly, and CREATE TABLE IF NOT EXISTS
// makes re-runs a no-op.

import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export async function runMigrations(): Promise<{ applied: string[] }> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set — provision Neon via Vercel Marketplace, then run `vercel env pull .env.local`",
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
