// HubSpot OAuth 2.0 — used solely for identity verification at sign-in.
//
// We deliberately do NOT keep HubSpot's access_token or refresh_token
// around after sign-in. The OAuth handshake confirms (a) the user has a
// HubSpot account, (b) they belong to GTSE's HubSpot portal (hub_id
// check), and (c) returns user identity (id, email, name). From that
// point, the user is tracked via a server-side session record (see
// lib/auth/sessions.ts) and a session cookie. Future requests don't
// touch HubSpot at all — only our DB.
//
// Why this split:
//   - Simpler model: no refresh-token lifecycle, no token storage.
//   - Faster: middleware checks a session row, not HubSpot.
//   - Aligned with master plan §10.3 — minimise secret surface.

import "server-only";

const HUBSPOT_OAUTH_BASE = "https://app-eu1.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_TOKEN_INFO_URL = "https://api.hubapi.com/oauth/v1/access-tokens/";

export type TokenInfo = {
  hub_id: number;
  user_id: number;
  user: string; // user's email
  hub_domain: string;
  scopes: string[];
  token_type: string;
  expires_in: number;
};

/**
 * Build the URL we redirect the user to in order to start the OAuth
 * flow. `state` is a one-time CSRF token we round-trip back through the
 * callback to prove the redirect wasn't initiated by a third party.
 */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const url = new URL(HUBSPOT_OAUTH_BASE);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

/**
 * Exchange the one-time `code` returned by HubSpot for an access token.
 * The access token is then used ONCE (in `getTokenInfo`) to fetch the
 * authenticating user's identity, then discarded.
 */
export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `HubSpot token exchange failed: HTTP ${res.status} — ${text.substring(0, 200)}`,
    );
  }

  return res.json();
}

/**
 * Look up the metadata (hub_id, user_id, email) attached to a HubSpot
 * access token. This is the function that proves the user belongs to
 * GTSE's HubSpot portal — the caller checks `info.hub_id` matches the
 * env-configured GTSE hub_id and rejects otherwise.
 */
export async function getTokenInfo(accessToken: string): Promise<TokenInfo> {
  const res = await fetch(`${HUBSPOT_TOKEN_INFO_URL}${accessToken}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `HubSpot token info failed: HTTP ${res.status} — ${text.substring(0, 200)}`,
    );
  }
  return res.json();
}

/**
 * Fetch the user's display name. The token-info endpoint returns email
 * but not first/last name; this hits the owners API to get a name we can
 * show in the UI. Failure is non-fatal — we just fall back to the email.
 */
export async function getUserName(
  accessToken: string,
  userId: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/owners/${userId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { firstName?: string; lastName?: string };
    const parts = [body.firstName, body.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : null;
  } catch {
    return null;
  }
}
