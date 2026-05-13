// Edge-safe ONLY. Used by /api/chat, /api/insights/regenerate, and the
// Edge facade impl (lib/data/impl/postgres-edge.ts in M5). Never imports
// the porsager `postgres` library — that would break the Edge bundle.
//
// `getHttpSql()` lazy-inits the Neon HTTP client so importing this
// module in test or build contexts (where DATABASE_URL may be absent)
// doesn't throw — only the first actual call does.

import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getHttpSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  // Accept both naming conventions:
  //   - DATABASE_URL (older Vercel-Postgres integration, master-plan default)
  //   - POSTGRES_URL (current Vercel-Neon Marketplace integration, what
  //     `vercel env pull` produces today)
  // Use the pooled URL — Edge HTTP requests are stateless and short-lived.
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Expected DATABASE_URL or POSTGRES_URL. " +
        "Provision Neon via Vercel Marketplace, then run `vercel env pull --environment=production .env.local`.",
    );
  }
  _sql = neon(url);
  return _sql;
}
