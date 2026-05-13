// Test: pull ARCHIVED deals from HubSpot — we excluded them in
// pull-deals.ts (archived=false). If GTSE archives won deals after
// closing, we'd be missing the bulk of their sales history.

import { getHubSpotClient } from "../lib/ingest/hubspot-client";

async function main() {
  const client = getHubSpotClient();

  console.log("Counting ACTIVE deals (archived=false)...");
  let activeTotal = 0;
  {
    let after: string | undefined;
    do {
      const page = await client.crm.deals.basicApi.getPage(100, after, [], undefined, undefined, false);
      activeTotal += page.results.length;
      after = page.paging?.next?.after;
    } while (after);
  }
  console.log(`Active deals: ${activeTotal}`);

  console.log("\nCounting ARCHIVED deals (archived=true)...");
  let archivedTotal = 0;
  let oldestArchived: Date | null = null;
  let newestArchived: Date | null = null;
  const stagesSeen = new Map<string, number>();
  {
    let after: string | undefined;
    do {
      const page = await client.crm.deals.basicApi.getPage(
        100,
        after,
        ["dealstage", "amount", "closedate", "createdate"],
        undefined,
        undefined,
        true,
      );
      for (const d of page.results) {
        archivedTotal++;
        const stage = d.properties.dealstage ?? "(null)";
        stagesSeen.set(stage, (stagesSeen.get(stage) ?? 0) + 1);
        if (d.properties.createdate) {
          const t = new Date(d.properties.createdate);
          if (!oldestArchived || t < oldestArchived) oldestArchived = t;
          if (!newestArchived || t > newestArchived) newestArchived = t;
        }
      }
      after = page.paging?.next?.after;
    } while (after);
  }
  console.log(`Archived deals: ${archivedTotal}`);
  if (oldestArchived) console.log(`  Oldest: ${oldestArchived.toISOString().slice(0, 10)}`);
  if (newestArchived) console.log(`  Newest: ${newestArchived.toISOString().slice(0, 10)}`);
  console.log(`  Stages seen:`);
  const sorted = Array.from(stagesSeen.entries()).sort((a, b) => b[1] - a[1]);
  for (const [stage, n] of sorted.slice(0, 10)) {
    console.log(`    ${stage.padEnd(15)} ${n}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
