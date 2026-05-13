# NetSuite — Deferred to Phase 2

**Status:** removed from Phase 1 on **2026-05-13** following a team decision to
simplify scope. HubSpot is the sole CRM/data source for Phase 1. NetSuite may
be reintroduced in Phase 2 to provide authoritative invoice/inventory data.

This document is the **canonical restoration record**. It captures (a) what was
removed and why, (b) what was intentionally left in place as Phase 2 hooks, (c)
the actual SQL/TypeScript that was removed (so restoration does not depend on
git history surviving), and (d) a step-by-step Phase 2 restoration checklist.

---

## Why it was deferred

- **Risk reduction.** NetSuite OAuth 2.0 (M2M JWT) and SuiteQL were the
  highest-risk integration in the master plan. Cutting them removes a class of
  failures (token exchange, JWT signing, SuiteQL syntax differences across
  account configurations) before the dashboard goes in front of the CEO.
- **Faster Phase 1.** Roughly 40-50% scope reduction. One ingest cron instead
  of two, one credential pair instead of two, no identity/reconciliation layer
  between HubSpot and NetSuite customer masters.
- **Acceptable Phase 1 substitutes exist** in HubSpot deal data — see "What
  got Phase 1 substitutes" below. The metrics are directional rather than
  authoritative, which is fine for a sales-team triage dashboard.

---

## Files modified — what was removed

Five files changed. Each is paired below with the exact code that was removed
so restoration can happen without consulting git.

### 1. `db/migrations/004_raw_netsuite.sql` — entire content stubbed

The file now contains only a no-op `SELECT 1;` so the migration runner records
it as applied (preserving the 001…008 sequence). The original content created
six append-only mirror tables for NetSuite source data.

<details>
<summary>Original SQL — paste back to restore</summary>

```sql
-- Append-only mirror of NetSuite source data. Same DISTINCT-ON-by-modified
-- pattern as raw_hubspot; payload holds the raw SuiteQL row, schema lives
-- in staging views. inventory_snapshots is point-in-time rather than
-- record-versioned (each cron run writes a fresh snapshot row per item ×
-- location).

CREATE TABLE IF NOT EXISTS raw_netsuite.customers (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_customers_lastmodified
  ON raw_netsuite.customers (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.items (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_items_lastmodified
  ON raw_netsuite.items (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.sales_orders (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_sales_orders_lastmodified
  ON raw_netsuite.sales_orders (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.purchase_orders (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_purchase_orders_lastmodified
  ON raw_netsuite.purchase_orders (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.vendors (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_vendors_lastmodified
  ON raw_netsuite.vendors (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.inventory_snapshots (
  snapshot_at         timestamptz NOT NULL,
  item_internal_id    bigint NOT NULL,
  location_id         bigint NOT NULL,
  quantity_on_hand    numeric NOT NULL,
  quantity_available  numeric,
  payload             jsonb,
  PRIMARY KEY (snapshot_at, item_internal_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_inventory_item_recent
  ON raw_netsuite.inventory_snapshots (item_internal_id, snapshot_at DESC);
```

</details>

### 2. `db/migrations/005_staging.sql` — `staging.sku` view removed

The view that exposed NetSuite items as a SKU dimension table is gone. The
rest of 005 (`staging.customer`, `staging.fact_order_lines`) is unchanged
and works on HubSpot data alone.

<details>
<summary>Original SQL — paste back between `staging.customer` and `staging.fact_order_lines`</summary>

```sql
-- ─── staging.sku ───────────────────────────────────────────────────
-- One row per NetSuite item. Joined to HubSpot line items in
-- fact_order_lines via the SKU code (Phase 0 §A2 confirms the matching
-- property name).
CREATE OR REPLACE VIEW staging.sku AS
SELECT
  ni.payload->>'itemid'              AS sku_code,
  ni.internal_id                     AS ns_item_id,
  ni.payload->>'displayname'         AS name,
  -- PHASE 0 §B6/B7: confirm the SuiteQL field names for category +
  -- standard cost. These are common NetSuite columns but vary by
  -- account configuration.
  NULLIF(ni.payload->>'class', '')   AS category,
  NULLIF(ni.payload->>'cost', '')::numeric    AS unit_cost,
  NULLIF(ni.payload->>'baseprice', '')::numeric AS list_price,
  (ni.payload->>'isinactive')::boolean AS is_inactive
FROM (
  SELECT DISTINCT ON (internal_id) *
  FROM raw_netsuite.items
  ORDER BY internal_id, last_modified DESC
) ni;
```

</details>

### 3. `db/migrations/007_marts.sql` — `marts.inventory_status` view removed

The materialized view that powered the dashboard's inventory page is gone.
All other marts (`dim_customer`, `whales`, `lapsed`, `reorder_due`,
`kpi_overview`, `rfm_segments`, `company_health`) are unchanged.

<details>
<summary>Original SQL — paste back after `marts.company_health`</summary>

```sql
-- ─── marts.inventory_status ────────────────────────────────────────
-- Per-SKU stock + 90-day sales velocity. Joins the latest inventory
-- snapshot to staging.sku, then layers on velocity from
-- staging.fact_order_lines.
--
-- Phase 0 §B7 confirms the per-location inventory pattern; if GTSE
-- uses a different pattern, the join from inventory_snapshots to sku
-- needs adjusting.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.inventory_status AS
WITH latest_snapshot AS (
  SELECT max(snapshot_at) AS snap FROM raw_netsuite.inventory_snapshots
),
on_hand AS (
  SELECT
    item_internal_id,
    sum(quantity_on_hand)    AS total_on_hand,
    sum(quantity_available)  AS total_available
  FROM raw_netsuite.inventory_snapshots, latest_snapshot
  WHERE snapshot_at = latest_snapshot.snap
  GROUP BY item_internal_id
),
velocity AS (
  SELECT
    sku_code,
    sum(quantity)            AS units_sold_90d
  FROM staging.fact_order_lines
  WHERE order_date > CURRENT_DATE - 90
  GROUP BY sku_code
)
SELECT
  s.sku_code                                              AS sku_code,
  s.name                                                  AS name,
  s.category                                              AS category,
  coalesce(oh.total_on_hand, 0)                           AS total_on_hand,
  coalesce(oh.total_available, 0)                         AS total_available,
  coalesce(v.units_sold_90d, 0)                           AS units_sold_90d,
  -- Days of stock at current sales velocity. NULL if no recent sales.
  CASE
    WHEN coalesce(v.units_sold_90d, 0) = 0 THEN NULL
    ELSE round((coalesce(oh.total_on_hand, 0) * 90.0) / v.units_sold_90d)::int
  END                                                     AS days_of_stock_remaining
FROM staging.sku s
LEFT JOIN on_hand  oh ON oh.item_internal_id = s.ns_item_id
LEFT JOIN velocity v  ON v.sku_code = s.sku_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_status_sku ON marts.inventory_status (sku_code);
```

</details>

### 4. `db/migrations/008_retention.sql` — NetSuite snapshot retention removed

The retention function lost its third `DELETE` statement and a corresponding
return column. The Phase 1 version cleans only `app.ingestion_runs` and
`app.api_access_log`. The 180-day NetSuite inventory cleanup is gone.

<details>
<summary>Original SQL — replace the current Phase 1 function</summary>

```sql
CREATE OR REPLACE FUNCTION app.fn_retention_cleanup()
RETURNS TABLE(
  ingestion_runs_deleted bigint,
  api_access_log_deleted bigint,
  inventory_snapshots_deleted bigint
) AS $$
DECLARE
  d1 bigint;
  d2 bigint;
  d3 bigint;
BEGIN
  DELETE FROM app.ingestion_runs WHERE started_at < now() - interval '90 days';
  GET DIAGNOSTICS d1 = ROW_COUNT;

  DELETE FROM app.api_access_log WHERE logged_at < now() - interval '90 days';
  GET DIAGNOSTICS d2 = ROW_COUNT;

  DELETE FROM raw_netsuite.inventory_snapshots
  WHERE snapshot_at < now() - interval '180 days';
  GET DIAGNOSTICS d3 = ROW_COUNT;

  RETURN QUERY SELECT d1, d2, d3;
END;
$$ LANGUAGE plpgsql;
```

</details>

### 5. `app/api/cron/transform/route.ts` — `inventory_status` removed from refresh list

Two changes: the `MART_VIEWS` array dropped `marts.inventory_status`, and the
cleanup result type dropped the `inventory_snapshots_deleted` field.

<details>
<summary>Original TypeScript — restore in two places</summary>

```typescript
// 1. MART_VIEWS array (top of file):
const MART_VIEWS = [
  "marts.dim_customer",
  "marts.whales",
  "marts.lapsed",
  "marts.reorder_due",
  "marts.kpi_overview",
  "marts.rfm_segments",
  "marts.company_health",
  "marts.inventory_status",
] as const;

// 2. Cleanup result type (inside GET handler):
const cleanupRows = await sql<
  {
    ingestion_runs_deleted: bigint;
    api_access_log_deleted: bigint;
    inventory_snapshots_deleted: bigint;
  }[]
>`SELECT * FROM app.fn_retention_cleanup()`;

// 3. serialiseCleanup function (bottom of file):
function serialiseCleanup(c?: {
  ingestion_runs_deleted: bigint;
  api_access_log_deleted: bigint;
  inventory_snapshots_deleted: bigint;
}) {
  if (!c) return null;
  return {
    ingestion_runs_deleted: Number(c.ingestion_runs_deleted),
    api_access_log_deleted: Number(c.api_access_log_deleted),
    inventory_snapshots_deleted: Number(c.inventory_snapshots_deleted),
  };
}
```

</details>

---

## What was intentionally left in place — DO NOT delete as dead code

These eight references look like NetSuite leftovers but were kept deliberately
so Phase 2 restoration is a smaller diff. A future cleanup pass might be
tempted to remove them — don't. Each is a Phase 2 hook.

| Location | What it is | Why keep it |
|---|---|---|
| `db/migrations/001_schemas.sql` line 7 | `CREATE SCHEMA IF NOT EXISTS raw_netsuite;` | Empty schema. Harmless. Phase 2 docks tables in here. |
| `db/migrations/003_app_tables.sql` lines 6, 17 | `'netsuite'` listed as valid `source` in inline comments | Documentation only. Will be used again. |
| `db/migrations/005_staging.sql` line 40 | `staging.customer.ns_customer_id` column | Will be NULL for all rows in Phase 1 (no Company has the `netsuite_customer_id` HubSpot property populated yet). Becomes the join key in Phase 2. |
| `db/migrations/007_marts.sql` line 43 | `marts.dim_customer.ns_customer_id` passthrough | Same as above — NULL passthrough, no functional cost. |
| `lib/ingest/pull-companies.ts` line 21 | `"netsuite_customer_id"` in HubSpot property pull list | HubSpot's API silently ignores unknown property names in property requests; including this is free. When the property gets populated, it lands in `raw_hubspot.companies.payload` automatically. |
| `lib/ingest/pull-line-items.ts` line 8 | Comment about SKU matching NetSuite item codes | Documentation only. |

---

## Stale messaging — not blocking, clean up when convenient

Two pieces of UI/API copy still mention NetSuite. Update next time the
surrounding code is touched:

- `app/settings/page.tsx` line ~335 — describes the future data warehouse as
  "populated by nightly Vercel Cron jobs from HubSpot and NetSuite." Should
  read "from HubSpot" for Phase 1.
- `app/api/v1/route.ts` line ~28 — public API description mentions
  "Vercel Cron jobs from HubSpot and NetSuite." Same fix.

---

## What got Phase 1 substitutes (HubSpot-derived proxies)

| Phase 1 substitute | What it really should be (Phase 2) | Caveat |
|---|---|---|
| `sum(deal.amount) WHERE dealstage = 'closedwon'` | NetSuite invoice line totals | Deal amount ≠ shipped revenue. Deals can be reopened or have their amount edited after close. Finance reports will diverge. |
| `max(deal.closedate) WHERE dealstage = 'closedwon'` | NetSuite sales order ship date / invoice date | Reorders that bypass HubSpot (placed direct, via EDI, via NetSuite) are invisible — customer looks lapsed in the dashboard but is still buying. |
| `hs_last_activity_date` on Company | NetSuite invoice recency or shipment recency | Activity ≠ purchase. A sales call counts; a re-order placed in NetSuite without a deal does not. |

**The numbers in Phase 1 are directionally right but not authoritative.** This
should be surfaced in the UI before the dashboard reaches anyone outside the
sales team — a "CRM-pipeline-based" tooltip on revenue and lapse metrics.

---

## What the dashboard loses without NetSuite

- **Inventory status page** — days-of-stock, on-hand counts, sales velocity
  per SKU. No data source in Phase 1. The page stays on mock data if exercised.
- **True invoice-based revenue** — replaced with the deal-amount proxy above.
- **Vendor records and purchase orders** — out of scope entirely, not even
  visible in mock data.

---

## Phase 2 restoration checklist

When NetSuite is reintroduced, work through this in order. Each step is
independently testable.

### Pre-flight

1. **Answer the Phase 0 questions** in `docs/phase-0-question-guide.md` that
   specifically gate NetSuite:
   - **§A1** — exact HubSpot deal stage value for "closed-won / shipped."
     Master plan defaults to `'closedwon'`; some pipelines use a custom ID.
   - **§A2** — HubSpot line-item property that matches NetSuite item code.
     Default `hs_sku`; may be a custom property.
   - **§A6** — HubSpot Company property containing the NetSuite customer ID.
     Default `netsuite_customer_id`; may be `gtse_netsuite_id` or similar.
   - **§B6** — SuiteQL field for item category. Often `class`, sometimes a
     custom field.
   - **§B7** — SuiteQL pattern for per-location inventory snapshots. Verify
     `inventoryitemlocations` is the right join, or adapt.

### Credentials

2. **Add NetSuite env vars to Vercel** (production + preview + development):
   - **Preferred — OAuth 2.0 M2M JWT:**
     - `NETSUITE_ACCOUNT_ID`
     - `NETSUITE_OAUTH2_CLIENT_ID`
     - `NETSUITE_OAUTH2_PRIVATE_KEY` (RSA private key, base64-encoded)
     - `NETSUITE_OAUTH2_CERT_ID` (the certificate ID assigned by NetSuite)
   - **Fallback — TBA OAuth 1.0:**
     - `NETSUITE_TBA_CONSUMER_KEY`
     - `NETSUITE_TBA_CONSUMER_SECRET`
     - `NETSUITE_TBA_TOKEN_ID`
     - `NETSUITE_TBA_TOKEN_SECRET`

   Use `vercel env add` interactively for each. Then `vercel env pull .env.local`
   to sync.

### Schema

3. **Restore migration 004** — paste the SQL from the collapsible block above
   into `db/migrations/004_raw_netsuite.sql`, replacing the current stub.
   Or `git show <commit>:db/migrations/004_raw_netsuite.sql > db/migrations/004_raw_netsuite.sql`.

4. **Restore `staging.sku` in 005** — paste the SQL block back between
   `staging.customer` and `staging.fact_order_lines`.

5. **Restore `marts.inventory_status` in 007** — paste the SQL block back
   after `marts.company_health`.

6. **Restore inventory retention in 008** — replace the current 2-DELETE
   function with the 3-DELETE version above.

7. **Apply the new migrations.** Either:
   - Run a single `ALTER` migration that drops the inventory_status mart
     (if it exists from a prior run) and recreates everything, OR
   - Manually `DROP MATERIALIZED VIEW IF EXISTS marts.inventory_status;`
     `DROP VIEW IF EXISTS staging.sku;` then re-run `pnpm db:migrate`.

### Ingest

8. **Add NetSuite ingest modules** in `lib/ingest/`:
   - `netsuite-client.ts` — OAuth 2.0 M2M token exchange + SuiteQL POST helper
   - `pull-netsuite-customers.ts` — incremental by `lastmodifieddate`
   - `pull-netsuite-items.ts` — same
   - `pull-netsuite-sales-orders.ts` — same
   - `pull-netsuite-purchase-orders.ts` — same
   - `pull-netsuite-vendors.ts` — same
   - `pull-netsuite-inventory.ts` — point-in-time snapshot, no cursor

9. **Add the ingest cron route** at `app/api/cron/ingest-netsuite/route.ts`.
   Pattern matches `/api/cron/ingest-hubspot/route.ts` — Bearer auth via
   `CRON_SECRET`, runs migrations, calls each pull module, logs to
   `app.ingestion_runs`.

10. **Add the Vercel cron schedule.** Either via dashboard (Project Settings →
    Cron Jobs) or `vercel.json`:
    ```json
    {
      "crons": [
        { "path": "/api/cron/ingest-netsuite", "schedule": "0 2 * * *" }
      ]
    }
    ```
    Choose a time offset from the HubSpot ingest so they don't contend.

### Transform

11. **Restore `marts.inventory_status` in MART_VIEWS** in
    `app/api/cron/transform/route.ts` (the array near the top).

12. **Restore `inventory_snapshots_deleted`** in the cleanup result type and
    in `serialiseCleanup` at the bottom of the same file.

### Revenue + lapse swap (the meaningful Phase 2 win)

13. **Decide the new fact_order_lines source.** Two options:
    - **(a) Replace HubSpot deals with NetSuite invoices** as the source of
      truth for revenue and order recency. Cleanest. Update
      `staging.fact_order_lines` in `005_staging.sql` to join
      `raw_netsuite.invoices` × `raw_netsuite.invoice_lines` × NS customers,
      then translate `ns_customer_id` back to `staging.customer.id` via the
      `ns_customer_id` column.
    - **(b) Run both side-by-side.** Add a second fact table
      `staging.fact_invoice_lines` and let `marts.dim_customer` prefer
      NetSuite-derived revenue, falling back to HubSpot deals when a customer
      has no NS link. Useful during a transition period.

14. **Verify** the math is producing the same magnitudes as the NetSuite
    Saved Searches that GTSE's finance team uses. Likely sources of drift:
    currency conversion, fiscal-period rollup, returns/credits handling.

### Cleanup

15. **Update stale UI messaging** (see "Stale messaging" section above).
16. **Update `docs/build-state.md`** to reflect Phase 2 status.
17. **Update master plan** (`project-whale-master-plan.md`) and execution
    plan (`project-whale-execution-plan.md`) — reinstate the NetSuite
    sections from git history, mark them Phase 2.

### Verification

18. **Smoke test:**
    ```bash
    curl -H "Authorization: Bearer $CRON_SECRET" \
      https://gtse-demo-dashboard.vercel.app/api/cron/ingest-netsuite
    ```
    Expect a JSON response with non-zero `rows_ingested` for each entity.

19. **Mart row counts** should rise: `marts.inventory_status` should have
    one row per active SKU; `marts.dim_customer.lifetime_revenue` should
    match NetSuite's Saved Search totals for the top 10 customers (within a
    couple of percent, accounting for in-flight orders).

20. **Cron logs:** `vercel logs --since 1d | grep ingest-netsuite` should
    show clean runs after each schedule trigger.

---

## Snapshot reference

The state immediately **before** NetSuite was cut: HEAD of `main` on
**2026-05-13**, just prior to the commit that introduced this document.
The five files modified are:

- `db/migrations/004_raw_netsuite.sql`
- `db/migrations/005_staging.sql`
- `db/migrations/007_marts.sql`
- `db/migrations/008_retention.sql`
- `app/api/cron/transform/route.ts`

`git log --diff-filter=M -- <path>` on any of these will surface the cut commit.
