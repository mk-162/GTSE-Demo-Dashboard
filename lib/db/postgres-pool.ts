// Node-only ONLY. Used by /api/internal/*, /api/v1/* (post-M5), all
// /api/cron/*, and the Node facade impl (lib/data/impl/postgres-node.ts
// in M5). Never imports @neondatabase/serverless — keeps the libraries
// strictly partitioned per runtime.

import "server-only";
import postgres from "postgres";

let _pool: ReturnType<typeof postgres> | null = null;

export function getPool() {
  if (_pool) return _pool;
  // Accept both naming conventions:
  //   - DATABASE_URL / DATABASE_URL_UNPOOLED (older Vercel-Postgres integration,
  //     master-plan default)
  //   - POSTGRES_URL / POSTGRES_URL_NON_POOLING (current Vercel-Neon Marketplace
  //     integration, what `vercel env pull` produces today)
  // Prefer unpooled when available — this module is Node-only and runs ingest/
  // transform crons that want larger client-side pools.
  const unpooled =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING;
  const pooled = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  const url = unpooled ?? pooled;
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Expected one of: " +
        "DATABASE_URL_UNPOOLED, DATABASE_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL. " +
        "Provision Neon via Vercel Marketplace, then run `vercel env pull --environment=production .env.local`.",
    );
  }
  _pool = postgres(url, {
    max: unpooled ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return _pool;
}
