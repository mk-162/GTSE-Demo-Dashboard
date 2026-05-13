// HubSpot OAuth session gate. Runs on every page request before the route
// handler. Uses Edge runtime + Neon HTTP driver (Edge-safe) — no Node
// modules.
//
// Auth flow:
//   1. Every page request hits this middleware.
//   2. Exempt paths bypass (login UI, auth API, public v1 API, cron API).
//   3. For everything else, look up the `whale_session` cookie value in
//      app.sessions. If a non-expired row exists, allow. Otherwise
//      redirect to /login?from=<original-path>.
//
// The shared-password gate was replaced here on 2026-05-13 (M5).
// WHALE_PASSWORD is no longer consulted. The `/api/auth` namespace was
// reused for the OAuth + session endpoints — anything under it bypasses
// the session check.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, lookupSession } from "@/lib/auth/sessions";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow:
  //   - /login (the UI that bounces users into HubSpot OAuth)
  //   - /api/auth/* (the OAuth + session endpoints themselves)
  //   - /api/v1/* (external API with its own Bearer-token auth)
  //   - /api/cron/* (Vercel Cron with its own CRON_SECRET Bearer check)
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/v1") ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }

  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const session = await lookupSession(sessionId);
    if (session) {
      return NextResponse.next();
    }
  }

  // No valid session — bounce to /login with the original path preserved.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname || "/");
  return NextResponse.redirect(url);
}

// Run on every page route except Next.js internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
  ],
};
