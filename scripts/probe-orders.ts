// Probe HubSpot Orders to verify access + understand the schema shape.
// Goal: confirm field names, look at associations, get total count.

async function main() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    console.error("HUBSPOT_PRIVATE_APP_TOKEN not set");
    process.exit(1);
  }

  // 1. Schema — what properties does the orders object have?
  console.log("─── Schema (first 30 properties on orders) ───");
  const schemaRes = await fetch("https://api.hubapi.com/crm/v3/properties/orders", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (schemaRes.ok) {
    const body = (await schemaRes.json()) as {
      results: { name: string; label: string; type: string }[];
    };
    console.log(`Total properties: ${body.results.length}`);
    for (const p of body.results.slice(0, 30)) {
      console.log(`  ${p.name.padEnd(40)} ${p.type.padEnd(10)} ${p.label}`);
    }
  } else {
    console.log(`Schema fetch failed: HTTP ${schemaRes.status}`);
    console.log((await schemaRes.text()).substring(0, 300));
  }

  console.log("\n─── Total count ───");
  // Use search API to get exact total count
  const countRes = await fetch("https://api.hubapi.com/crm/v3/objects/orders/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filterGroups: [], properties: [], sorts: [], limit: 1, after: "0" }),
  });
  if (countRes.ok) {
    const body = (await countRes.json()) as { total: number };
    console.log(`Total orders: ${body.total.toLocaleString()}`);
  } else {
    console.log(`Count failed: HTTP ${countRes.status}`);
    console.log((await countRes.text()).substring(0, 300));
  }

  console.log("\n─── 3 sample orders (default properties) ───");
  const sampleRes = await fetch("https://api.hubapi.com/crm/v3/objects/orders?limit=3", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (sampleRes.ok) {
    const body = (await sampleRes.json()) as { results: { id: string; properties: Record<string, string | null> }[] };
    for (const o of body.results) {
      console.log(`Order ${o.id}:`);
      for (const [k, v] of Object.entries(o.properties)) {
        if (v !== null) console.log(`  ${k.padEnd(30)} ${v}`);
      }
      console.log("");
    }
  } else {
    console.log(`Sample failed: HTTP ${sampleRes.status}`);
    console.log((await sampleRes.text()).substring(0, 300));
  }

  console.log("─── Order associations on a sample order ───");
  const sample2 = await fetch("https://api.hubapi.com/crm/v3/objects/orders?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (sample2.ok) {
    const body = (await sample2.json()) as { results: { id: string }[] };
    const orderId = body.results[0]?.id;
    if (orderId) {
      console.log(`Inspecting associations for order ${orderId}:`);
      for (const target of ["companies", "contacts", "deals", "line_items", "products"]) {
        const assocRes = await fetch(
          `https://api.hubapi.com/crm/v3/objects/orders/${orderId}/associations/${target}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (assocRes.ok) {
          const a = (await assocRes.json()) as { results: { id: string }[] };
          console.log(`  → ${target.padEnd(15)} ${a.results.length} associated`);
        } else {
          console.log(`  → ${target.padEnd(15)} HTTP ${assocRes.status}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
