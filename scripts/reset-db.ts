// One-shot DESTRUCTIVE reset: drops every user schema and recreates an
// empty `public`. Run before `pnpm db:migrate` when you want a clean
// slate (e.g. wiping an old kv_store, or recovering from a failed
// migration that left half-built objects behind).
//
// Run via: pnpm tsx --env-file=.env.local scripts/reset-db.ts
//
// Prompts for confirmation by checking the URL contains "neon.tech" —
// won't run against an arbitrary Postgres without that string, to keep
// it from being pointed at a production DB by accident.

import postgres from "postgres";

const url =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;

if (!url) {
  console.error(
    "No Postgres connection string found. Expected one of: " +
      "POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED, POSTGRES_URL, DATABASE_URL.",
  );
  process.exit(1);
}

if (!url.includes("neon.tech")) {
  console.error(
    "Safety check failed: connection string doesn't look like a Neon URL " +
      "(should contain 'neon.tech'). Refusing to run a destructive reset. " +
      "Edit this script if you really mean it.",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

async function main() {
  // Drop every user schema we know about (and `public`), then recreate `public`.
  // CASCADE wipes tables, views, materialized views, functions, sequences, etc.
  // IF EXISTS keeps it idempotent — works equally well on a fresh DB and a
  // half-populated one.
  console.log("Dropping schemas...");
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS app CASCADE;
    DROP SCHEMA IF EXISTS raw_hubspot CASCADE;
    DROP SCHEMA IF EXISTS raw_netsuite CASCADE;
    DROP SCHEMA IF EXISTS staging CASCADE;
    DROP SCHEMA IF EXISTS marts CASCADE;
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);
  console.log("✓ Database wiped clean.");
  console.log("");
  console.log("Next: pnpm db:migrate");
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
