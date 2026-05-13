// Probe HubSpot for transaction-style CRM objects we might have missed.
// Each one is a separate scope from Deals — Orders/Invoices/Quotes/etc.
// live under the "Commerce" CRM extension.
//
// 200 = object exists + we have read access
// 403 = object exists but we lack the scope
// 404 = object doesn't exist in this portal
// other = ???

const OBJECT_TYPES = [
  "orders",          // Commerce orders — most likely candidate for "all sales imported"
  "invoices",        // Commerce invoices
  "quotes",          // Sales quotes
  "subscriptions",   // Recurring revenue
  "commerce_payments", // Payments
  "carts",           // Pre-checkout carts
  "products",        // SKU catalog
  "line_items",      // (we already pull these but worth confirming)
  "tickets",         // Service tickets
  "appointments",    // Calendar appointments
  "leads",           // The Lead object (different from lifecyclestage=lead)
];

async function probe(objectType: string, token: string): Promise<{ status: number; total?: number; sample?: unknown; message?: string }> {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status = res.status;
  if (status === 200) {
    const body = (await res.json()) as { total?: number; results?: unknown[] };
    return { status, total: body.total, sample: body.results?.[0] };
  }
  const body = await res.text();
  return { status, message: body.substring(0, 200) };
}

async function main() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    console.error("HUBSPOT_PRIVATE_APP_TOKEN not set");
    process.exit(1);
  }

  for (const objectType of OBJECT_TYPES) {
    const r = await probe(objectType, token);
    const status =
      r.status === 200 ? `✓ ${r.status}` :
      r.status === 403 ? `✗ ${r.status} no-scope` :
      r.status === 404 ? `— ${r.status} not-installed` :
      `? ${r.status}`;
    const totalStr = r.total !== undefined ? ` total=${r.total}` : "";
    const msg = r.message ? ` — ${r.message.replace(/\n/g, " ").substring(0, 80)}` : "";
    console.log(`${objectType.padEnd(20)} ${status}${totalStr}${msg}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
