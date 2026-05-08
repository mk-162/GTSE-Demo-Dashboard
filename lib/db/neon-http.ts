// Edge-safe ONLY. Used by /api/chat, /api/insights/regenerate, and the
// Edge facade impl (lib/data/impl/postgres-edge.ts in M5). Never imports
// the porsager `postgres` library — that would break the Edge bundle.

import "server-only";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  // In production we expect Neon to be provisioned via the Vercel
  // Marketplace, which auto-sets DATABASE_URL on every scope. Throwing
  // here gives a clearer error than the lazy "neon needs a connection
  // string" surface from inside a streaming route.
  throw new Error("DATABASE_URL not set — provision Neon via Vercel Marketplace");
}

export const httpSql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : (() => {
      throw new Error("DATABASE_URL not set — provision Neon via Vercel Marketplace");
    });
