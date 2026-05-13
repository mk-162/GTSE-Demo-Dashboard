// GET /api/auth/hubspot/login
//
// Initiates the HubSpot OAuth flow. Generates a one-time state token
// (CSRF protection), stores it in a short-lived cookie, then redirects
// the user to HubSpot's consent screen. The callback at
// /api/auth/hubspot/callback will verify the state matches.
//
// `from` query param is preserved through the round-trip so we can
// redirect the user back to the page they originally requested after
// sign-in completes.

import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl } from "@/lib/auth/hubspot-oauth";

export const runtime = "nodejs";

const STATE_COOKIE = "whale_oauth_state";
const FROM_COOKIE = "whale_oauth_from";

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "OAuth not configured. HUBSPOT_OAUTH_CLIENT_ID and HUBSPOT_OAUTH_REDIRECT_URI must be set on Vercel.",
      },
      { status: 500 },
    );
  }

  const state = generateState();
  const from = req.nextUrl.searchParams.get("from") ?? "/";

  // Minimum scope for OAuth identity verification. We use the existing
  // HUBSPOT_PRIVATE_APP_TOKEN for actual data pulls, so this OAuth flow
  // doesn't need read-data scopes — just identity.
  const url = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    scopes: ["oauth"],
  });

  const res = NextResponse.redirect(url);
  // Short-lived cookies — only need to survive the round trip to HubSpot
  // and back. 10 minutes is plenty.
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  res.cookies.set(FROM_COOKIE, from, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
