import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/companies/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

const COMPANY_PROPERTIES = [
  "name",
  "industry",
  "country",
  "numberofemployees",
  "lifecyclestage",
  "hubspot_owner_id",
  "createdate",
  "hs_lastmodifieddate",
  // hs_last_activity_date: HubSpot auto-maintains this from engagements
  // (calls, emails, meetings, notes, tasks). Lets us derive "days since
  // last activity" without granting separate engagement-object scopes.
  // See app/api/cron/ingest-hubspot/route.ts for why engagements are
  // parked for Phase 2.
  "hs_last_activity_date",
  // `netsuite_customer_id` is intentionally OMITTED in Phase 1. HubSpot's
  // Search API (used for incremental sync) returns HTTP 400 if any
  // property doesn't exist on the company schema — and GTSE's HubSpot
  // doesn't have this property since NetSuite isn't installed.
  // Phase 2 restoration: add it back. See docs/netsuite-deferred.md.
] as const;

// ─── Backfill (initial cursor = null) ──────────────────────────────
// Uses basicApi.getPage. The Search API caps paginated results at 10,000
// records when there's no filter; GTSE has ~40k companies, so the search
// path can't see them all on first ingest. Basic API has no such cap —
// we paginate the full set, then advance the cursor to maxModified so
// subsequent runs can use the search-filtered incremental path.
async function backfillCompanies(): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = new Date(0);

  do {
    const page = await client.crm.companies.basicApi.getPage(
      100,                          // limit (max 100 for basic API)
      after,                        // pagination cursor; undefined on first iteration
      [...COMPANY_PROPERTIES],      // properties to fetch
      undefined,                    // propertiesWithHistory (not needed)
      undefined,                    // associations (handled separately)
      false,                        // archived
    );

    const rows = page.results
      .filter((c) => c.properties.hs_lastmodifieddate)
      .map((c) => ({
        hs_object_id: Number(c.id),
        hs_lastmodified: c.properties.hs_lastmodifieddate as string,
        payload: c.properties,
      }));

    count += await upsertHubSpotObject("companies", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

// ─── Incremental (cursor != null) ──────────────────────────────────
// Uses searchApi.doSearch with hs_lastmodifieddate >= since. Search
// supports filters which lift the 10k cap effectively — in steady-state
// nightly cron there will be far fewer than 10k modifications per day.
// If that ever stops being true (long pause between runs, mass bulk
// update), the same pattern as backfill can be inserted here as fallback.
async function incrementalCompanies(since: Date): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = since;

  do {
    const page = await client.crm.companies.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_lastmodifieddate",
              operator: FilterOperatorEnum.Gte,
              value: since.getTime().toString(),
            },
          ],
        },
      ],
      properties: [...COMPANY_PROPERTIES],
      sorts: [],
      limit: 100,
      after: after ?? "0",
    });

    const rows = page.results
      .filter((c) => c.properties.hs_lastmodifieddate)
      .map((c) => ({
        hs_object_id: Number(c.id),
        hs_lastmodified: c.properties.hs_lastmodifieddate as string,
        payload: c.properties,
      }));

    count += await upsertHubSpotObject("companies", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

export async function pullHubSpotCompanies(): Promise<number> {
  const since = await getCursor("hubspot", "companies");

  const { count, maxModified } =
    since === null ? await backfillCompanies() : await incrementalCompanies(since);

  // Only advance the cursor if we actually pulled something — a no-op run
  // shouldn't reset to "now" and skip records that arrive in the gap.
  if (count > 0) {
    await setCursor("hubspot", "companies", maxModified);
  }
  return count;
}
