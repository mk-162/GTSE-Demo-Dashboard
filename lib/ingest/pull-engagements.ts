import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/objects/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// PHASE 0: confirm the Sensitive Data flag is OFF (§A8). If it's ON,
// engagement reads return 403 and the cron will fail. Phase 0 also
// flagged that >500k engagements requires per-object-type splitting
// (§A7); this implementation pulls all engagement types together — fine
// for typical volumes, will need partition if Phase 0 says we're over.
const ENGAGEMENT_PROPERTIES = [
  "hs_engagement_type",
  "hs_timestamp",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
] as const;

// PII strip-list. Removed at the boundary so no email body or attachment
// IDs ever land in raw_hubspot.engagements. See master plan §10.3 item 5.
const PII_FIELDS_TO_STRIP = [
  "hs_body_preview",
  "hs_body_preview_html",
  "hs_email_text",
  "hs_email_html",
  "hs_attachment_ids",
] as const;

function stripPii(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitised = { ...properties };
  for (const f of PII_FIELDS_TO_STRIP) {
    delete sanitised[f];
  }
  return sanitised;
}

export async function pullHubSpotEngagements(): Promise<number> {
  const client = getHubSpotClient();
  const since = await getCursor("hubspot", "engagements");
  let after: string | undefined;
  let total = 0;
  let maxModified = since ?? new Date(0);

  do {
    // The engagements API surface in @hubspot/api-client is under
    // crm.objects with the "engagements" object type. Search supports
    // the same filter pattern as other CRM objects.
    const page = await client.crm.objects.searchApi.doSearch("engagements", {
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
      properties: [...ENGAGEMENT_PROPERTIES],
      limit: 100,
      after,
    });

    const rows = page.results
      .filter((e) => e.properties.hs_lastmodifieddate)
      .map((e) => ({
        hs_object_id: Number(e.id),
        hs_lastmodified: e.properties.hs_lastmodifieddate as string,
        payload: stripPii(e.properties as Record<string, unknown>),
      }));

    total += await upsertHubSpotObject("engagements", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  if (total > 0) await setCursor("hubspot", "engagements", maxModified);
  return total;
}
