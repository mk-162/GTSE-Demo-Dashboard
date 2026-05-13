import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/objects/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// HubSpot Orders are the actual transaction records GTSE imports from
// their upstream order systems (NetSuite + BigCommerce). 74k+ records
// across GBP / USD / EUR currencies. This is the data the dashboard's
// revenue/cadence/lapse analytics were designed for — NOT the Deals
// object, which we now know is sales-rep pipeline tracking.
//
// Properties pulled here are the minimum set needed for Phase 1
// revenue + cadence analytics. The full schema has 110 properties;
// the rest can be added later if specific features need them.

const ORDER_PROPERTIES = [
  "hs_external_order_id",          // Source-system order # (NetSuite SO #)
  "hs_total_price",                 // Per-transaction value with penny precision
  "hs_currency_code",               // GBP / USD / EUR — primary region marker
  "hs_external_created_date",       // When the order was originally placed
  "hs_closed_date",                 // When the order was fulfilled
  "hs_pipeline",                    // Order pipeline UUID
  "hs_pipeline_stage",              // Stage UUID (Open/Processed/Shipped/Delivered/Cancelled)
  "hs_createdate",                  // When imported to HubSpot
  "hs_lastmodifieddate",            // Cursor
] as const;

// Backfill (initial cursor = null): use basicApi to bypass the Search
// API's 10k pagination cap. See lib/ingest/pull-companies.ts for the
// full rationale. With 74k orders this matters.
async function backfillOrders(): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = new Date(0);

  do {
    const page = await client.crm.objects.basicApi.getPage(
      "orders",
      100,
      after,
      [...ORDER_PROPERTIES],
      undefined,
      undefined,
      false,
    );

    const rows = page.results
      .filter((o) => o.properties.hs_lastmodifieddate)
      .map((o) => ({
        hs_object_id: Number(o.id),
        hs_lastmodified: o.properties.hs_lastmodifieddate as string,
        payload: o.properties,
      }));

    count += await upsertHubSpotObject("orders", rows);

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
async function incrementalOrders(since: Date): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = since;

  do {
    const page = await client.crm.objects.searchApi.doSearch("orders", {
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
      properties: [...ORDER_PROPERTIES],
      sorts: [],
      limit: 100,
      after: after ?? "0",
    });

    const rows = page.results
      .filter((o) => o.properties.hs_lastmodifieddate)
      .map((o) => ({
        hs_object_id: Number(o.id),
        hs_lastmodified: o.properties.hs_lastmodifieddate as string,
        payload: o.properties,
      }));

    count += await upsertHubSpotObject("orders", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

export async function pullHubSpotOrders(): Promise<number> {
  const since = await getCursor("hubspot", "orders");
  const { count, maxModified } =
    since === null ? await backfillOrders() : await incrementalOrders(since);
  if (count > 0) await setCursor("hubspot", "orders", maxModified);
  return count;
}
