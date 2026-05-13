// Diagnostic: prints first 10 chars of HUBSPOT_PRIVATE_APP_TOKEN (safe to
// share), then hits HubSpot's companies endpoint directly via fetch.
// If this returns 401, the token is invalid — likely rotated or revoked.
// If 403, scopes are wrong. If 200, the token works and any SDK 401 is a
// client-config issue.

export {}; // force module mode so `main` doesn't collide with sibling scripts

async function main() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    console.error("HUBSPOT_PRIVATE_APP_TOKEN not set in env.");
    process.exit(1);
  }

  console.log(`Token: ${token.substring(0, 10)}... (length ${token.length})`);
  console.log("");

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`HTTP ${res.status} ${res.statusText}`);
  const body = await res.text();
  console.log("Body:", body.substring(0, 500));
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
