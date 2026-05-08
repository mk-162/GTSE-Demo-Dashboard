// Node-only ONLY. Used by /api/internal/*, /api/v1/* (post-M5), all
// /api/cron/*, and the Node facade impl (lib/data/impl/postgres-node.ts
// in M5). Never imports @neondatabase/serverless — keeps the libraries
// strictly partitioned per runtime.

import "server-only";
import postgres from "postgres";

let _pool: ReturnType<typeof postgres> | null = null;

export function getPool() {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set — provision Neon via Vercel Marketplace, then run `vercel env pull .env.local`",
    );
  }
  // Neon's pooled URL handles connection pooling on the server side, so we
  // can use a small client-side pool. For the unpooled URL we let postgres
  // manage normally (default max 10).
  _pool = postgres(url, {
    max: process.env.DATABASE_URL_UNPOOLED ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return _pool;
}
