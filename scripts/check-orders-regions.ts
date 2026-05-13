// Sample a larger set of orders + bucket by currency, source store,
// and pipeline. Tells us how GTSE splits UK vs US orders.

async function main() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    console.error("HUBSPOT_PRIVATE_APP_TOKEN not set");
    process.exit(1);
  }

  const props = [
    "hs_currency_code",
    "hs_source_store",
    "hs_pipeline",
    "hs_total_price",
    "hs_billing_address_country",
  ].join(",");

  const byCurrency = new Map<string, { count: number; total: number }>();
  const bySource = new Map<string, number>();
  const byPipeline = new Map<string, number>();
  const byBillingCountry = new Map<string, number>();

  let after: string | undefined;
  let totalScanned = 0;
  const maxPages = 50; // 50 pages × 100 = 5k orders sample

  for (let i = 0; i < maxPages; i++) {
    const url = new URL("https://api.hubapi.com/crm/v3/objects/orders");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", props);
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error(`Failed page ${i}: HTTP ${res.status}`);
      break;
    }
    const body = (await res.json()) as {
      results: { id: string; properties: Record<string, string | null> }[];
      paging?: { next?: { after: string } };
    };

    for (const o of body.results) {
      totalScanned++;
      const cur = o.properties.hs_currency_code ?? "(null)";
      const prev = byCurrency.get(cur) ?? { count: 0, total: 0 };
      prev.count++;
      prev.total += Number(o.properties.hs_total_price ?? 0);
      byCurrency.set(cur, prev);

      const src = o.properties.hs_source_store ?? "(null)";
      bySource.set(src, (bySource.get(src) ?? 0) + 1);

      const pipe = o.properties.hs_pipeline ?? "(null)";
      byPipeline.set(pipe, (byPipeline.get(pipe) ?? 0) + 1);

      const country = o.properties.hs_billing_address_country ?? "(null)";
      byBillingCountry.set(country, (byBillingCountry.get(country) ?? 0) + 1);
    }

    if (!body.paging?.next?.after) break;
    after = body.paging.next.after;
  }

  console.log(`Scanned ${totalScanned} orders.\n`);

  console.log("─── By currency ───");
  for (const [cur, v] of byCurrency) {
    console.log(`  ${cur.padEnd(10)} ${v.count.toString().padStart(5)} orders   total ${v.total.toFixed(2)}`);
  }

  console.log("\n─── By source store ───");
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${src.padEnd(30)} ${n}`);
  }

  console.log("\n─── By pipeline ───");
  for (const [pipe, n] of [...byPipeline.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pipe.padEnd(40)} ${n}`);
  }

  console.log("\n─── By billing country (top 10) ───");
  for (const [c, n] of [...byBillingCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${c.padEnd(30)} ${n}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
