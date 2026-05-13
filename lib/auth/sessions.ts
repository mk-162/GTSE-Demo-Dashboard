// Server-side session storage. Sessions are DB rows in app.sessions;
// the cookie value is a random 32-byte hex string keyed to that row.
//
// Why DB-backed rather than signed JWT:
//   - Revocation is a single DELETE — when someone leaves GTSE, IT can
//     `DELETE FROM app.sessions WHERE hub_user_email = ...` and they're
//     out immediately, no waiting for token expiry.
//   - Audit-friendly — last_seen_at, created_at, expires_at, plus the
//     auth_audit table give a complete picture of dashboard access.
//   - Simpler — no JWT signing keys, no key rotation, no clock-skew
//     pitfalls.
//
// Trade-off: every middleware request hits Neon. For GTSE's volume this
// is fine; if it ever becomes a hot path, add a 30-second in-memory
// cache or move to signed cookies + revocation list.

import "server-only";

import { getHttpSql } from "@/lib/db/neon-http";
import { getPool } from "@/lib/db/postgres-pool";

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
 * works in both Node (the auth callback route) and Edge (middleware).
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a new session row. Node-only — called from the OAuth callback
 * route after a successful sign-in.
 */
export async function createSession(params: {
  id: string;
  hubUserId: string;
  hubUserEmail: string;
  hubUserName: string | null;
  hubId: number;
}): Promise<void> {
  const sql = getPool();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  await sql`
    INSERT INTO app.sessions
      (id, hub_user_id, hub_user_email, hub_user_name, hub_id, expires_at)
    VALUES
      (${params.id}, ${params.hubUserId}, ${params.hubUserEmail},
       ${params.hubUserName}, ${params.hubId}, ${expiresAt.toISOString()})
  `;
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

/**
 * Delete a session (sign-out). Node-only — called from the
 * DELETE /api/auth/session route.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sql = getPool();
  await sql`DELETE FROM app.sessions WHERE id = ${sessionId}`;
}

/**
 * Record an authentication event for audit purposes. Non-blocking —
 * caller can fire and forget.
 */
export async function logAuthEvent(params: {
  event: "sign_in" | "sign_out" | "sign_in_rejected";
  hubUserId?: string;
  hubUserEmail?: string;
  hubId?: number;
  reason?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  const sql = getPool();
  await sql`
    INSERT INTO app.auth_audit
      (event, hub_user_id, hub_user_email, hub_id, reason, ip, user_agent)
    VALUES
      (${params.event}, ${params.hubUserId ?? null},
       ${params.hubUserEmail ?? null}, ${params.hubId ?? null},
       ${params.reason ?? null}, ${params.ip ?? null}::inet,
       ${params.userAgent ?? null})
  `;
}
