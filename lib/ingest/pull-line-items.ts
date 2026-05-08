import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/line_items/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// PHASE 0: confirm `hs_sku` is the property carrying the SKU code that
// matches NetSuite item codes (§A2). If GTSE uses a different property
// (e.g. `sku_code`, `product_code`), update this list and the
// staging.fact_order_lines view.
const LINE_ITEM_PROPERTIES = [
  "name",
  "hs_sku", // PHASE 0
  "hs_product_id",
  "quantity",
  "price",
  "amount",
  "hs_lastmodifieddate",
] as const;

export async function pullHubSpotLineItems(): Promise<number> {
  const client = getHubSpotClient();
  const since = await getCursor("hubspot", "line_items");
  let after: string | undefined;
  let total = 0;
  let maxModified = since ?? new Date(0);

  do {
    const page = await client.crm.lineItems.searchApi.doSearch({
      filterGroups: since
        ? [
            {
              filters: [
                {
                  propertyName: "hs_lastmodifieddate",
                  operator: FilterOperatorEnum.Gte,
                  value: since.getTime().toString(),
                },
              ],
            },
          ]
        : [],
      properties: [...LINE_ITEM_PROPERTIES],
      limit: 100,
      after,
    });

    const rows = page.results
      .filter((li) => li.properties.hs_lastmodifieddate)
      .map((li) => ({
        hs_object_id: Number(li.id),
        hs_lastmodified: li.properties.hs_lastmodifieddate as string,
        payload: li.properties,
      }));

    total += await upsertHubSpotObject("line_items", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  if (total > 0) await setCursor("hubspot", "line_items", maxModified);
  return total;
}
