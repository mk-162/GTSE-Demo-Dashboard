import { runMigrations } from "@/lib/db/migrate";
import { getPool } from "@/lib/db/postgres-pool";
import { pullHubSpotCompanies } from "@/lib/ingest/pull-companies";
import { pullHubSpotDeals } from "@/lib/ingest/pull-deals";
import { pullHubSpotLineItems } from "@/lib/ingest/pull-line-items";
import { pullHubSpotContacts } from "@/lib/ingest/pull-contacts";
import { pullHubSpotOwners } from "@/lib/ingest/pull-owners";
import { pullHubSpotOrders } from "@/lib/ingest/pull-orders";
// pullHubSpotEngagements is parked for Phase 2 — see comment in GET handler.
// import { pullHubSpotEngagements } from "@/lib/ingest/pull-engagements";
import { pullDealAssociations } from "@/lib/ingest/pull-deal-associations";
import { pullOrderAssociations } from "@/lib/ingest/pull-order-associations";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  // Auth required everywhere — including local dev. Vercel sets the
  // Authorization: Bearer $CRON_SECRET header automatically once the env
  // var is set; locally, hit this route with the same header to test.
  // Bypassing auth in dev creates a path that exists in dev but not in
  // prod — exactly how prod-only bugs hide.
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // CRITICAL: run migrations BEFORE the first INSERT into app.ingestion_runs.
  // On a fresh database the app schema doesn't exist yet; migrations create
  // it. The migration runner is itself idempotent so calling it on every
  // cron invocation is cheap.
  await runMigrations();

  const sql = getPool();
  const runRows = await sql<{ run_id: string }[]>`
    INSERT INTO app.ingestion_runs (source, status)
    VALUES ('hubspot', 'running')
    RETURNING run_id
  `;
  const runId = runRows[0].run_id;

  try {
    // Order matters: deals + line items must be in raw_hubspot before
    // pullDealAssociations() can resolve the deal→company and
    // deal→line_item relationships.
    const companies = await pullHubSpotCompanies();
    const deals = await pullHubSpotDeals();
    const line_items = await pullHubSpotLineItems();
    const contacts = await pullHubSpotContacts();
    const owners = await pullHubSpotOwners();
    const orders = await pullHubSpotOrders();
    // Engagements pull is parked for Phase 2 (2026-05-13). Our Phase 1
    // HubSpot service key has scopes for companies/contacts/deals/
    // line_items/owners — NOT for emails/calls/meetings/notes/tasks (which
    // is what HubSpot calls engagements). Calling the engagements pull
    // would 403 and fail the whole cron. marts.dim_customer's engagement
    // columns (last_engagement_date, days_since_last_engagement,
    // email_opens_l60d) already default to NULL — the dashboard tolerates
    // missing engagement data. For a lighter "last activity" signal,
    // hs_last_activity_date on Company is pulled instead (see
    // lib/ingest/pull-companies.ts COMPANY_PROPERTIES).
    // const engagements = await pullHubSpotEngagements();
    const engagements = 0;
    const associations = await pullDealAssociations();
    const orderAssociations = await pullOrderAssociations();

    const counts = {
      companies,
      deals,
      line_items,
      contacts,
      owners,
      orders,
      engagements,
      assoc_deal_company: associations.companies,
      assoc_deal_line_item: associations.lineItems,
      assoc_order_company: orderAssociations.companies,
    };
    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    await sql`
      UPDATE app.ingestion_runs
      SET status = 'success', finished_at = now(), rows_ingested = ${total}
      WHERE run_id = ${runId}
    `;
    return Response.json({ ok: true, run_id: runId, counts });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sql`
      UPDATE app.ingestion_runs
      SET status = 'failed', finished_at = now(),
          errors = ${JSON.stringify({ message })}
      WHERE run_id = ${runId}
    `;
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
