// Bearer-token authentication for the public /api/v1/* surface.
// Token is sourced from WHALE_API_TOKEN env var. For demo we fall back to
// the same value as WHALE_PASSWORD so a single secret is enough to test.

const DEMO_FALLBACK = "gtse2026";

export function getApiToken(): string {
  return (
    process.env.WHALE_API_TOKEN ||
    process.env.WHALE_PASSWORD ||
    DEMO_FALLBACK
  );
}

/**
 * Validate the Authorization header against the configured API token.
 * Accepts both `Authorization: Bearer <token>` and `?token=<token>`.
 *
 * Returns:
 *   - null if the request is authenticated
 *   - a Response (401) if not — caller should `return` it directly
 */
export function requireApiToken(req: Request): Response | null {
  const expected = getApiToken();
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  // Allow query-string fallback for tools that don't support custom headers.
  let queryToken = "";
  try {
    queryToken = new URL(req.url).searchParams.get("token") || "";
  } catch {
    /* ignore */
  }

  const supplied = bearer || queryToken;
  if (supplied && supplied === expected) return null;

  return new Response(
    JSON.stringify({
      error: supplied ? "invalid_token" : "missing_token",
      hint: "Send Authorization: Bearer <token> or ?token=<token>. See /settings for setup.",
    }),
    { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } },
  );
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      ...init?.headers,
    },
  });
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
