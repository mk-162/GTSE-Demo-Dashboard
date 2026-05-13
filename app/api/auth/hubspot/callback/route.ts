// GET /api/auth/hubspot/callback
//
// HubSpot redirects here after the user authorises (or rejects) the
// OAuth consent. We:
//   1. Verify the `state` matches the cookie we set in /login — CSRF check.
//   2. Exchange the authorization `code` for an access token.
//   3. Look up the token's metadata (hub_id, user_id, email).
//   4. REJECT if hub_id != GTSE's portal — that's the critical guard
//      against random HubSpot users elsewhere signing in.
//   5. Create a session row in app.sessions.
//   6. Set the whale_session cookie.
//   7. Redirect back to the originally-requested URL (the `from` cookie).
//
// All failure paths log to app.auth_audit.

import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForToken,
  getTokenInfo,
  getUserName,
} from "@/lib/auth/hubspot-oauth";
import {
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  createSession,
  generateSessionId,
  logAuthEvent,
} from "@/lib/auth/sessions";

export const runtime = "nodejs";

const STATE_COOKIE = "whale_oauth_state";
const FROM_COOKIE = "whale_oauth_from";

function failRedirect(reason: string): NextResponse {
  // Strip any cookies on failure and bounce back to /login with the
  // reason in the query string so the UI can show it.
  const url = new URL("/login", "http://placeholder");
  url.searchParams.set("error", reason);
  const res = NextResponse.redirect(url.toString());
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(FROM_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
  const expectedHubId = process.env.GTSE_HUBSPOT_HUB_ID;

  if (!clientId || !clientSecret || !redirectUri || !expectedHubId) {
    return NextResponse.json(
      {
        error:
          "OAuth not fully configured. Required env vars: HUBSPOT_OAUTH_CLIENT_ID, HUBSPOT_OAUTH_CLIENT_SECRET, HUBSPOT_OAUTH_REDIRECT_URI, GTSE_HUBSPOT_HUB_ID.",
      },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  const from = req.cookies.get(FROM_COOKIE)?.value ?? "/";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = req.headers.get("user-agent") ?? undefined;

  // User declined the OAuth consent, or HubSpot returned an error.
  if (error) {
    await logAuthEvent({
      event: "sign_in_rejected",
      reason: `hubspot_error: ${error}`,
      ip,
      userAgent,
    });
    return failRedirect(`hubspot_error:${error}`);
  }

  // CSRF check: state must match the cookie value.
  if (!state || !expectedState || state !== expectedState) {
    await logAuthEvent({
      event: "sign_in_rejected",
      reason: "state_mismatch",
      ip,
      userAgent,
    });
    return failRedirect("state_mismatch");
  }

  if (!code) {
    await logAuthEvent({
      event: "sign_in_rejected",
      reason: "no_code",
      ip,
      userAgent,
    });
    return failRedirect("no_code");
  }

  // Exchange the code for an access token.
  let accessToken: string;
  try {
    const tokens = await exchangeCodeForToken({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });
    accessToken = tokens.access_token;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAuthEvent({
      event: "sign_in_rejected",
      reason: `token_exchange_failed: ${message.substring(0, 200)}`,
      ip,
      userAgent,
    });
    return failRedirect("token_exchange_failed");
  }

  // Look up token metadata.
  let tokenInfo: Awaited<ReturnType<typeof getTokenInfo>>;
  try {
    tokenInfo = await getTokenInfo(accessToken);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAuthEvent({
      event: "sign_in_rejected",
      reason: `token_info_failed: ${message.substring(0, 200)}`,
      ip,
      userAgent,
    });
    return failRedirect("token_info_failed");
  }

  // CRITICAL: reject anyone whose hub_id doesn't match GTSE's. Without
  // this check, ANY HubSpot user in the world could sign in (they just
  // need a HubSpot account anywhere).
  if (String(tokenInfo.hub_id) !== String(expectedHubId)) {
    await logAuthEvent({
      event: "sign_in_rejected",
      hubUserId: String(tokenInfo.user_id),
      hubUserEmail: tokenInfo.user,
      hubId: tokenInfo.hub_id,
      reason: `wrong_hub_id (got ${tokenInfo.hub_id}, expected ${expectedHubId})`,
      ip,
      userAgent,
    });
    return failRedirect("wrong_hub_id");
  }

  // Best-effort: fetch their display name. Falls back to email-only.
  const userName = await getUserName(accessToken, tokenInfo.user_id);

  // Create session row.
  const sessionId = generateSessionId();
  try {
    await createSession({
      id: sessionId,
      hubUserId: String(tokenInfo.user_id),
      hubUserEmail: tokenInfo.user,
      hubUserName: userName,
      hubId: tokenInfo.hub_id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAuthEvent({
      event: "sign_in_rejected",
      hubUserId: String(tokenInfo.user_id),
      hubUserEmail: tokenInfo.user,
      hubId: tokenInfo.hub_id,
      reason: `session_create_failed: ${message.substring(0, 200)}`,
      ip,
      userAgent,
    });
    return failRedirect("session_create_failed");
  }

  await logAuthEvent({
    event: "sign_in",
    hubUserId: String(tokenInfo.user_id),
    hubUserEmail: tokenInfo.user,
    hubId: tokenInfo.hub_id,
    ip,
    userAgent,
  });

  // Set the session cookie and redirect home (or back to the originally-
  // requested URL).
  const dest = new URL(from.startsWith("/") ? from : "/", req.url);
  const res = NextResponse.redirect(dest.toString());
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(FROM_COOKIE);
  return res;
}
