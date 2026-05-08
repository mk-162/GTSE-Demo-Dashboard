import "server-only";
import { Client } from "@hubspot/api-client";

let _client: Client | null = null;

export function getHubSpotClient(): Client {
  if (_client) return _client;
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    throw new Error(
      "HUBSPOT_PRIVATE_APP_TOKEN not set — generate a Private App in HubSpot " +
        "with the scopes listed in phase-0-questions.md and add it to Vercel env vars",
    );
  }
  _client = new Client({ accessToken: token, numberOfApiCallRetries: 3 });
  return _client;
}
