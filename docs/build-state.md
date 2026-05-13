# Project Whale — Build state

**As of 2026-05-13 evening.** Dashboard is **live in production with real GTSE data**. This doc captures: what's working, what's still incomplete, data quality issues discovered, and the Phase 2 roadmap.

**Production URL:** https://gtse-demo-dashboard.vercel.app (HubSpot OAuth sign-in required; only GTSE HubSpot users)

---

## Milestone progress

| Milestone | Status | Notes |
|---|---|---|
| **M1 — Server data facade** | ✅ Live | `lib/data/` with DataLayer + memory/postgres-{edge,node} impls. 18/18 contract tests green. |
| **M2 — HubSpot ingestion** | ✅ Live | 9 raw_hubspot tables populated: companies (40,730), deals (323), line_items (131,841), contacts (38,289), owners (11), **orders (74,653)**, plus association tables. |
| **M3 — NetSuite ingestion** | ⏸️ Deferred to Phase 2 | See `docs/netsuite-deferred.md` for full restoration plan. |
| **M4 — Marts + transform** | ✅ Live | All 7 marts populated with real data. Transform runs in ~26 seconds. |
| **M5 — Auth + data cutover** | ✅ Live | HubSpot OAuth replacing shared-password gate. `DATA_SOURCE=postgres` on production. |
| **M6 — Insights cron** | ❌ Not started | Nightly AI-generated narratives writing to `app.dashboard_insights`. Phase 1B candidate. |

---

## What's working today (production, real data)

| Mart | Row count | Notes |
|---|---|---|
| `fact_order_lines` | 52,265 | Real order transactions (one row per order, summed from `hs_total_price`) |
| `dim_customer` | 40,737 | The customer spine |
| `whales` | 100 | Top 50 per region by LTM revenue |
| `lapsed` | **3,329** | Customers with lapse_ratio ≥ 1.5 |
| `reorder_due` | **597** | Established customers (3+ orders) predicted to reorder soon |
| `kpi_overview` | 2 | UK + US per-region aggregates |
| `rfm_segments` | 11 | Real segment distribution (Hibernating, Loyal, Promising, AtRisk, Champion, CannotLose) |
| `company_health` | 6 | green / amber / unknown bands per region |

**Customer counts with real revenue:** UK 27,655 · US 525 · Total **28,180** (£8.96M attributable revenue).

**Top accounts visible on the dashboard:** JMP Wilcox (£228k, Loyal), Tree Pro US ($226k, Loyal), Avonline Network Services (103 orders, Loyal), R A C Motoring (Champion), POVITEC (152 orders, Champion), BABSCO Supply, Trooli, Telenco UK.

---

## Known data quality issues

### 1. ~22,000 orders without a company association

Of the 74,653 HubSpot Orders, only 52,366 (70%) have a `Order → Company` association. The other ~22,000 orders are guest checkouts, walk-ins, or manual imports without a customer ID — their revenue isn't attributable to any account in the dashboard.

**Impact:** total tracked revenue on the dashboard is £8.96M (attributable). Actual GTSE transaction volume in HubSpot is higher.

**Possible fixes (Phase 2):**
- Attribute by `hs_billing_address_email` → contact → company
- Pull deeper into NetSuite where customer associations are richer
- Accept the orphan revenue as "anonymous channel" and surface it as a separate aggregate

### 2. Sales-rep estimates vs. shipped revenue

HubSpot Deals (which we tracked first, before realising Orders existed) carry **round-numbered rep estimates** (e.g. £1,000 / £5,000 / £50,000) — these are NOT actual invoice values. We've stopped using Deals for revenue; `fact_order_lines` now sources from Orders (`hs_total_price` with penny precision).

Deals remain in the warehouse for pipeline analysis. We're just not using them for revenue.

### 3. Lifecycle stage is mostly "lead"

Out of 40,725 HubSpot companies: 40,414 are tagged `lead` (99%), 250 `opportunity`, **only 59 `customer`**. These tags appear to be inaccurate — many of the "lead"-tagged companies have many real orders. The lifecycle stage was used for one early dashboard hypothesis (filter to customers only) but we've correctly **ignored it** in favour of "company has order history" as the real-customer signal.

### 4. Health bands mostly "unknown"

Of the 40,737 customers in `dim_customer`: 33,423 UK + 1,511 US are tagged `health_band = unknown`. This is correct — they have no order history (or only one order), so the cadence and lapse signals can't be computed. The 2,229 with `amber`/`green` bands are the customers with enough order history to score.

This is a **data fact, not a bug.** Customers without order history genuinely have no health signal. Most of GTSE's HubSpot leads will sit at unknown until they convert.

### 5. SKU-level analytics are empty

`dim_customer.top_3_reorder_skus` and `top_3_cross_sell_skus` are still `ARRAY[]::text[]` placeholders. We have `Order → Line Item` associations available in HubSpot (would need a new pull) but no time-budget to wire up per-SKU aggregation yet. Order-level revenue is what's currently driving everything.

Phase 1B / Phase 2 candidate.

### 6. Currency mix folded into one region

3.3% of orders are EUR (2,488 orders). The dashboard's UK/US toggle doesn't have an EU bucket, so EUR orders are silently lumped under UK (the customer's region from company country). Acceptable for Phase 1; a proper "EU" region would require UI changes.

### 7. Engagements not pulled

The HubSpot service key was deliberately scoped without engagement objects (emails, calls, meetings, notes, tasks) to avoid the 5 extra scopes. Result: health scores fall back to "unknown" rather than computing cadence-vs-engagement-vs-email-opens. Phase 1B if engagement signal becomes important.

### 8. Stale UI strings + dashboard polish

Open list of small UX gaps:
- `/whales` table: customers with no orders show "Invalid Date" / "9999d" / a misleading green `0.00×` lapse badge → should be muted dashes
- Industry names from HubSpot are raw enum codes (`MECHANICAL_OR_INDUSTRIAL_ENGINEERING`) → needs a translation map
- Target builder sliders with min == max (`0 – 0`) → should be disabled or hidden
- Account detail "Recommended action" still says "Quarterly review on schedule" for accounts with zero data → needs context-aware logic
- Account meta region shows ", US" (leading comma when `region_subdiv` is null)

All ~1-2 hour fixes. Bundle them as a "Phase 1.5 polish" pass.

---

## What's left to do

### Imminent (when ready)

| Item | Effort | Notes |
|---|---|---|
| **Phase 1.5 polish** (UI fixes from issue #8) | ~2 hours | Cosmetic but visible; do before next exec demo |
| **Rotate `WHALE_PASSWORD`** | 5 min | The committed planning docs leak `gtse2026`; OAuth has replaced password auth at the middleware layer but the env var still exists as a fallback |
| **Schedule the nightly cron** | 15 min | Add `vercel.json` with `/api/cron/ingest-hubspot` at 02:00 UTC + `/api/cron/transform` at 02:30 UTC. Requires `CRON_SECRET` env var (not yet set). |
| **Generate + set `CRON_SECRET`** | 5 min | `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` → add to Vercel for all three scopes |

### Phase 1B (optional, lower priority)

| Item | Effort | Notes |
|---|---|---|
| Pull HubSpot engagements (5 new scopes + restore `pull-engagements.ts`) | 3 hours | Populates health score with cadence + engagement signal. Matt's view: low priority — engagement fields aren't used much. |
| Per-SKU analytics | 4-6 hours | Pull `Order → Line Item` associations + new `marts.customer_top_skus` + `marts.cross_sell_candidates` |
| M6 — Insights cron (nightly AI narratives) | 4 hours | Writes to `app.dashboard_insights`; dashboard reads from there instead of inline regenerate-on-click |
| EU region bucket | 4 hours | UK/US toggle becomes UK/US/EU throughout |

### Phase 2 (separate scope discussion)

| Item | Why |
|---|---|
| **NetSuite integration** | Full restoration plan in `docs/netsuite-deferred.md`. Recovers SKU-level invoice detail, the 22k orphan-order revenue, customer-master reconciliation. |
| Better orphan-order attribution | Resolve the 22k unassociated orders via email-based contact lookup |

---

## Phase 0 status — still relevant for Phase 2

Active markers in code:

```bash
grep -rn "PHASE 0" lib/ db/migrations/
```

| § | Description | Status |
|---|---|---|
| A1 | Closed-won deal stage | ✅ resolved (5 GTSE-specific stage IDs in migration 010) — but Deals are now de-prioritised in favour of Orders |
| A2 | Line-item SKU property name | Open — irrelevant for Phase 1 (we use order-level totals, not SKUs) |
| A3 | Region property on Company | ✅ derived from `country` (works) |
| A4 | Industry property | Open — needs taxonomy decision |
| A5, A7, A8 | Engagement-related | Open — irrelevant until engagement ingest |
| A6, B6, B7 | NetSuite-specific | Phase 2 — see `docs/netsuite-deferred.md` |

---

## Architecture notes (still relevant)

### Data flow
```
HubSpot REST API
  ↓ (lib/ingest/pull-*.ts — hybrid backfill/incremental pattern)
raw_hubspot.{companies, contacts, deals, line_items, owners, orders} + assoc_*
  ↓ (staging.* views — joins + DISTINCT-ON for latest record per ID)
staging.{customer, sku (deferred), fact_order_lines, owner}
  ↓ (marts.* materialised views — refreshed by /api/cron/transform)
marts.{dim_customer, whales, lapsed, reorder_due, kpi_overview, rfm_segments, company_health, fact_order_lines}
  ↓ (lib/data/impl/postgres-{node,edge}.ts — DataLayer impl)
API routes / Server Components
  ↓
Dashboard UI
```

### Auth flow
```
User → /login → "Sign in with HubSpot" button
  → /api/auth/hubspot/login → HubSpot OAuth consent
  → /api/auth/hubspot/callback (verifies hub_id matches GTSE's portal 144159461)
  → creates session row in app.sessions → sets whale_session cookie
  → redirect to dashboard
Middleware (edge runtime) verifies cookie against app.sessions on every request
```

---

## Things that could trip you up

- **HubSpot UI is mid-migration.** Service Keys (formerly Private Apps, formerly Legacy Apps) keep moving. The data-access service key is in **Settings → Integrations → Private Apps** (or wherever HubSpot has moved it this week). The OAuth Public App is in the **Developer Apps** area (developers.hubspot.com). These are two different things and not the same UI section.

- **HubSpot AI is a useful diagnostic.** When in doubt about what's in HubSpot, ask their AI assistant — it can directly inspect the portal and tell you which objects are populated. That's how we found Orders (74,653 records hidden behind a missing scope).

- **`pnpm` commands need `cd /c/AI_Project/GTSE/project-whale-mockup &&` first** when running via Bash tool.

- **`tsx` scripts need `--node-options="--conditions=react-server"` OR `NODE_OPTIONS="--conditions=react-server"`** to bypass `server-only` imports.

- **Postgres has a 65,534 parameter limit per query.** Bulk inserts of 75k+ rows need the UNNEST pattern (two arrays + per-row cast), not the `sql(rows)` tuple pattern.

- **CREATE OR REPLACE VIEW preserves column order.** Adding a new column in the middle of a SELECT errors with "cannot change name of view column" — new columns must go at the end.

- **Materialised views can't be ALTERed.** Changing the query of `marts.dim_customer` requires DROP + CASCADE (drops all 6 dependent marts) + CREATE + recreate all dependents.

- **`vercel env pull` returns empty strings for Marketplace-managed env vars.** Doesn't mean they're empty in production — Vercel hides them from CLI for security.

---

## Change log

| Date | Change |
|---|---|
| **2026-05-13 evening** | **🎉 ORDERS BREAKTHROUGH.** Found HubSpot Orders object (74k records, real penny-precise transactions). Added 3 service-key scopes. Built `pull-orders.ts`, `pull-order-associations.ts`. Migrations 017, 018, 019 reroute `staging.fact_order_lines` from Deals to Orders. Marts now populated with **28,180 real customers** and **£8.96M revenue**. `lapsed`/`reorder_due`/`rfm_segments`/`company_health` populated for the first time. |
| **2026-05-13 afternoon, part 3** | Phase 1A fixes: pulled HubSpot owners (`pull-owners.ts`, migration 015/016) — owner names now display for 5,173 customers instead of numeric IDs. `health_band = 'unknown'` for customers with no signal (was incorrectly defaulting to Green). Fixed `distinctOwners` double-WHERE bug breaking `/targets`. Fixed hardcoded `TODAY` in reorder-due route. |
| **2026-05-13 afternoon, part 2** | Production cutover: `DATA_SOURCE=postgres` set in Vercel, dashboard reads real Postgres data. Three bug-fix migrations applied (011 = materialise fact_order_lines for performance; 012 = customer_id lpad truncation; 013 = kpi_overview duplicate-key crash; 014 = deal-amount fallback for the original sparse-data state). `staging.sku` reference removed from `ordersForCompany` (post-NetSuite-cut cleanup). |
| **2026-05-13 afternoon, part 1** | HubSpot OAuth (M5) implemented. `app.sessions` + `app.auth_audit` tables (migration 009). `/api/auth/hubspot/{login,callback}` routes + `/api/auth/session`. Middleware rebuilt to use session cookie. `/login` page rebuilt with "Sign in with HubSpot" button. App shell shows signed-in user + sign-out. |
| **2026-05-13 morning** | NetSuite cut from Phase 1, deferred to Phase 2 (`docs/netsuite-deferred.md`). Neon DB provisioned. All 8 (now 19) migrations applied. HubSpot Private App / Service Key generated. Initial ingest of companies + deals + line_items + contacts. |
| 2026-05-08 | Initial state-of-play. M1 live, M2/M4 dormant, M3/M5/M6 not started. |
