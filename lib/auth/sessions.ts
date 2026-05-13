// Edge-safe portions of session management — types, constants,
// session-id generation (Web Crypto), and lookup via Neon HTTP.
//
// All Node-only operations (create, delete, audit log writes) live in
// lib/auth/sessions-node.ts. This split lets middleware.ts (Edge
// runtime) import only this file without dragging the `postgres`
// library into the Edge bundle.

import "server-only";
import { getHttpSql } from "@/lib/db/neon-http";

export const SESSION_COOKIE = "whale_session";
export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

export type SessionRow = {
  id: string;
  hub_user_id: string;
  hub_user_email: string;
  hub_user_name: string | null;
  hub_id: string; // bigint serialised as string
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
};

/**
 * Generate a cryptographically random session id. Uses Web Crypto so it
 * works in both Node (the auth callback route) and Edge (anything that
 * needs to mint a session).
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Look up a session by its id (the cookie value). Returns null if the
 * row doesn't exist or has expired. Edge-safe — uses Neon HTTP.
 *
 * Side effect: bumps last_seen_at on hit. This is fire-and-forget — the
 * UPDATE doesn't block the request.
 */
export async function lookupSession(sessionId: string): Promise<SessionRow | null> {
  if (!sessionId || sessionId.length !== 64) return null;

  const sql = getHttpSql();
  const rows = (await sql`
    SELECT id, hub_user_id, hub_user_email, hub_user_name, hub_id,
           created_at, last_seen_at, expires_at
    FROM app.sessions
    WHERE id = ${sessionId}
      AND expires_at > now()
    LIMIT 1
  `) as unknown as SessionRow[];

  if (rows.length === 0) return null;

  // Bump last_seen_at asynchronously — don't await, don't block the
  // middleware on this.
  void sql`UPDATE app.sessions SET last_seen_at = now() WHERE id = ${sessionId}`;

  return rows[0];
}
