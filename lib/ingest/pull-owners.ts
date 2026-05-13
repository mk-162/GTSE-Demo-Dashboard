import "server-only";
import { getHubSpotClient } from "./hubspot-client";
import { getPool } from "@/lib/db/postgres-pool";

// HubSpot Owners are the human sales reps / account managers assigned
// to companies and deals. We pull them so dim_customer can show
// "Sam Smith" instead of the raw owner_id like "1857024499".
//
// Owners are a small dataset (dozens to a few hundred for most accounts)
// so we always do a full pull — no cursor needed. The owners API doesn't
// support a `since` filter anyway.
//
// Required scope: crm.objects.owners.read (already on our service key).

export async function pullHubSpotOwners(): Promise<number> {
  const client = getHubSpotClient();
  const sql = getPool();

  let after: string | undefined;
  let total = 0;
  const rows: { hs_object_id: number; payload: Record<string, unknown> }[] = [];

  do {
    const page = await client.crm.owners.ownersApi.getPage(
      undefined, // email filter
      after,     // pagination cursor
      100,       // limit
      false,     // archived
    );

    for (const o of page.results) {
      rows.push({
        hs_object_id: Number(o.id),
        payload: o as unknown as Record<string, unknown>,
      });
    }
    after = page.paging?.next?.after;
  } while (after);

  if (rows.length === 0) return 0;

  // Upsert: replace existing rows. Owners change rarely; full replace
  // each run keeps the table fresh without needing modification tracking.
  const ids = rows.map((r) => r.hs_object_id);
  const payloads = rows.map((r) => JSON.stringify(r.payload));

  // Use the same UNNEST + per-row jsonb cast pattern as upsert.ts for
  // companies/deals (see lib/ingest/upsert.ts for the rationale).
  const result = await sql`
    INSERT INTO raw_hubspot.owners (hs_object_id, payload)
    SELECT id, p::jsonb FROM unnest(
      ${ids}::bigint[],
      ${payloads}::text[]
    ) AS t(id, p)
    ON CONFLICT (hs_object_id)
    DO UPDATE SET payload = EXCLUDED.payload, ingested_at = now()
  `;
  total = result.count;
  return total;
}
