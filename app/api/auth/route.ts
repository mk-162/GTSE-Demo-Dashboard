// Legacy password-gate endpoint. Replaced by HubSpot OAuth (M5,
// 2026-05-13). Kept here as a 410 Gone so any old clients (cached
// login forms, bookmarks) get a clear "this endpoint moved" signal
// instead of a confusing 404 or a silent succeed.
//
// To remove entirely: delete this file once we're confident no one is
// hitting it. The deletion can wait — having the explicit 410 makes the
// transition diagnosable from server logs.

import { NextResponse } from "next/server";

export const runtime = "edge";

const GONE_BODY = {
  ok: false,
  error:
    "The password-based auth endpoint has been removed. Sign in via HubSpot OAuth at /login.",
};

export async function POST() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}

export async function DELETE() {
  // Clear the legacy cookie if it's still hanging around in someone's
  // browser, so they get bounced to /login on the next request rather
  // than getting stuck on a stale "logged in" state.
  const res = NextResponse.json({ ok: true });
  res.cookies.set("whale_auth", "", { path: "/", maxAge: 0 });
  return res;
}
