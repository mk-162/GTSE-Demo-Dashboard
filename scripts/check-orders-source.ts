// Sample orders from each currency and inspect source/channel fields.
// Reveals whether GTSE's 3 currencies correspond to 3 different
// integrations / data sources.

const SOURCE_PROPS = [
  "hs_currency_code",
  "hs_source_store",
  "hs_object_source",
  "hs_object_source_label",
  "hs_object_source_detail_1",
  "hs_object_source_detail_2",
  "hs_object_source_detail_3",
  "hs_source_id",
  "hs_landing_site",
  "hs_referring_site",
  "hs_external_order_id",
  "hs_total_price",
];

async function sampleForCurrency(token: string, currency: string, n: number) {
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/orders/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: "hs_currency_code", operator: "EQ", value: currency }] },
      ],
      properties: SOURCE_PROPS,
      sorts: [],
      limit: n,
      after: "0",
    }),
  });
  const body = (await res.json()) as { results: { id: string; properties: Record<string, string | null> }[] };
  return body.results;
}

async function main() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    console.error("HUBSPOT_PRIVATE_APP_TOKEN not set");
    process.exit(1);
  }

  for (const currency of ["GBP", "USD", "EUR"]) {
    console.log(`\n══════ ${currency} samples ══════`);
    const orders = await sampleForCurrency(token, currency, 5);
    for (const o of orders) {
      console.log(`\nOrder ${o.id} (external_id=${o.properties.hs_external_order_id}, total=${o.properties.hs_total_price})`);
      for (const k of SOURCE_PROPS) {
        const v = o.properties[k];
        if (v !== null && v !== undefined) {
          console.log(`  ${k.padEnd(30)} ${v}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
