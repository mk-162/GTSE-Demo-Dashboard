// One-shot inspection: lists schemas, tables (with row counts + sizes),
// installed extensions, and total DB size. Read-only; no writes.
//
// Run via: tsx --env-file=<path> scripts/inspect-db.ts
// Reads DATABASE_URL_UNPOOLED first (direct connection — better for
// inspection queries that hit pg_catalog), falls back to DATABASE_URL.

import postgres from "postgres";

// Accept both naming conventions — see lib/db/postgres-pool.ts for rationale.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;
if (!url) {
  console.error(
    "No Postgres connection string found. Expected one of: " +
      "DATABASE_URL_UNPOOLED, DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL.",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

async function main() {
  const [version] = await sql`SELECT version()`;
  console.log(`Postgres version:`);
  console.log(`  ${version.version}`);
  console.log("");

  const [size] = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
  console.log(`Total database size: ${size.size}`);
  console.log("");

  const exts = await sql<{ extname: string; extversion: string }[]>`
    SELECT extname, extversion FROM pg_extension ORDER BY extname
  `;
  console.log(`Installed extensions (${exts.length}):`);
  for (const e of exts) console.log(`  ${e.extname} ${e.extversion}`);
  console.log("");

  const schemas = await sql<{ schema: string; tables: number }[]>`
    SELECT n.nspname AS schema, count(c.oid)::int AS tables
    FROM pg_namespace n
    LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relkind IN ('r', 'm', 'v')
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND n.nspname NOT LIKE 'pg_temp_%'
      AND n.nspname NOT LIKE 'pg_toast_temp_%'
    GROUP BY n.nspname
    ORDER BY n.nspname
  `;
  console.log(`Schemas (${schemas.length}):`);
  for (const s of schemas) console.log(`  ${s.schema} — ${s.tables} relation${s.tables === 1 ? "" : "s"}`);
  console.log("");

  const tables = await sql<{
    schema: string;
    name: string;
    kind: string;
    rows: string;
    size: string;
  }[]>`
    SELECT
      n.nspname AS schema,
      c.relname AS name,
      CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'm' THEN 'matview'
        WHEN 'v' THEN 'view'
        ELSE c.relkind::text
      END AS kind,
      coalesce(s.n_live_tup, 0)::text AS rows,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s
      ON s.schemaname = n.nspname AND s.relname = c.relname
    WHERE c.relkind IN ('r', 'm', 'v')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND n.nspname NOT LIKE 'pg_temp_%'
      AND n.nspname NOT LIKE 'pg_toast_temp_%'
    ORDER BY n.nspname, c.relname
  `;

  if (tables.length > 0) {
    console.log(`Relations (${tables.length}):`);
    let currentSchema = "";
    for (const t of tables) {
      if (t.schema !== currentSchema) {
        console.log(`  [${t.schema}]`);
        currentSchema = t.schema;
      }
      console.log(`    ${t.name.padEnd(40)} ${t.kind.padEnd(8)} ${t.rows.padStart(10)} rows  ${t.size}`);
    }
  } else {
    console.log("No user tables.");
  }
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
