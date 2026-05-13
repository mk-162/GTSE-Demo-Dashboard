// Node-only session operations — create, delete, and audit-log writes.
// These use the `postgres` library which doesn't work in Edge runtime,
// so they're segregated from lib/auth/sessions.ts (which is Edge-safe
// and importable from middleware).
//
// Importers (all Node-runtime routes):
//   - app/api/auth/hubspot/callback/route.ts
//   - app/api/auth/session/route.ts (DELETE handler)

import "server-only";
import { getPool } from "@/lib/db/postgres-pool";

/**
 * Create a new session row. Called from the OAuth callback after a
 * successful sign-in.
 */
export async function createSession(params: {
  id: string;
  hubUserId: string;
  hubUserEmail: string;
  hubUserName: string | null;
  hubId: number;
}): Promise<void> {
  const sql = getPool();
  const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
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
 * Delete a session (sign-out).
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
