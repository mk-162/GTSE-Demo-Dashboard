import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/deals/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// PHASE 0: confirm the deal stage value that means "closed-won / shipped"
// (§A1). The staging view in migration 005 filters on this value; the
// pull itself takes everything and lets staging decide.
const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "pipeline",
  "amount",
  "closedate",
  "createdate",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
] as const;

// Backfill (initial cursor = null): use basicApi to bypass the Search
// API's 10k pagination cap. See lib/ingest/pull-companies.ts for the
// full rationale.
async function backfillDeals(): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = new Date(0);

  do {
    const page = await client.crm.deals.basicApi.getPage(
      100,
      after,
      [...DEAL_PROPERTIES],
      undefined,
      undefined,
      false,
    );

    const rows = page.results
      .filter((d) => d.properties.hs_lastmodifieddate)
      .map((d) => ({
        hs_object_id: Number(d.id),
        hs_lastmodified: d.properties.hs_lastmodifieddate as string,
        payload: d.properties,
      }));

    count += await upsertHubSpotObject("deals", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

// Incremental (cursor != null): use searchApi with hs_lastmodifieddate
// filter — the filter usually keeps results under the 10k cap.
async function incrementalDeals(since: Date): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = since;

  do {
    const page = await client.crm.deals.searchApi.doSearch({
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
      properties: [...DEAL_PROPERTIES],
      sorts: [],
      limit: 100,
      after: after ?? "0",
    });

    const rows = page.results
      .filter((d) => d.properties.hs_lastmodifieddate)
      .map((d) => ({
        hs_object_id: Number(d.id),
        hs_lastmodified: d.properties.hs_lastmodifieddate as string,
        payload: d.properties,
      }));

    count += await upsertHubSpotObject("deals", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

export async function pullHubSpotDeals(): Promise<number> {
  const since = await getCursor("hubspot", "deals");
  const { count, maxModified } =
    since === null ? await backfillDeals() : await incrementalDeals(since);
  if (count > 0) await setCursor("hubspot", "deals", maxModified);
  return count;
}
