// GET /api/auth/session — returns the current logged-in user's info.
//   Used by the UI to show the user's name in the header.
//
// DELETE /api/auth/session — signs the user out by deleting the session
//   row and clearing the cookie.

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  deleteSession,
  logAuthEvent,
  lookupSession,
} from "@/lib/auth/sessions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const session = await lookupSession(sessionId);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.hub_user_id,
      email: session.hub_user_email,
      name: session.hub_user_name,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const session = await lookupSession(sessionId);
    await deleteSession(sessionId);
    if (session) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      await logAuthEvent({
        event: "sign_out",
        hubUserId: session.hub_user_id,
        hubUserEmail: session.hub_user_email,
        hubId: Number(session.hub_id),
        ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
