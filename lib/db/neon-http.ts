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
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set — provision Neon via Vercel Marketplace, then run `vercel env pull .env.local`",
    );
  }
  _sql = neon(url);
  return _sql;
}
