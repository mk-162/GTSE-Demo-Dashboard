// Lightweight password gate. Runs on every page request before the route handler.
// Uses Edge runtime + Web Crypto only — no Node modules.
//
// Cookie strategy: store SHA-256(password) as the auth token. If you have the
// password you can compute the cookie value; if you steal the cookie you have
// the same access as the password. Fine for a demo.

import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "whale_auth";

async function expectedToken(): Promise<string> {
  const password = process.env.WHALE_PASSWORD || "gtse2026";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page, the auth API, the public v1 API (which
  // has its own Bearer-token auth at endpoint level), and the cron API
  // (which validates Authorization: Bearer $CRON_SECRET inside each
  // route — without this exemption Vercel's cron invocations hit a 302
  // to /login and silently succeed-from-Vercel's-view while doing
  // nothing).
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/v1") ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await expectedToken();

  if (cookie === expected) {
    return NextResponse.next();
  }

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
