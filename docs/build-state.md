# Project Whale — Build state

**As of 2026-05-13 afternoon.** This doc tracks where the build is, what's dormant, and what the next concrete action is.

**Major scope change this session: NetSuite was cut from Phase 1.** HubSpot is now the sole data source. See `docs/netsuite-deferred.md` for the full restoration plan when NetSuite returns in Phase 2.

**Read order on resume:** this doc → `docs/netsuite-deferred.md` (Phase 2 restoration plan) → `docs/runbook.md` (operational procedures) → master plan (`C:\AI_Project\GTSE\project-whale-master-plan.md`, the technical contract — currently still references NetSuite, needs Phase 2 alignment pass). Then `git log --oneline -10` to confirm the commits below are still on `main`.

---

## Milestone progress

| Milestone | Status | What's there |
|---|---|---|
| **M1 — Server data facade** | ✅ Live in production | `lib/data/` with DataLayer interface + memoryImpl + postgres-{edge,node} impls. 18/18 contract tests green. All pages on Server Component shell + Client Component view. Region migrated to cookie. |
| **M2 — Neon + HubSpot ingestion** | 🟡 Infra live, ingest blocked on token | Neon `neon-cyclamen-basket` provisioned and connected. All 8 migrations applied. `lib/db/{neon-http,postgres-pool,migrate}.ts` accept both `DATABASE_*` and `POSTGRES_*` naming. `lib/ingest/pull-*.ts` modules in place. `/api/cron/ingest-hubspot` route ready. **Blocked:** the HubSpot token in `.env.local` returns 401 — needs verification that rotation actually took effect in HubSpot. |
| **M3 — NetSuite ingestion** | ⏸️ Deferred to Phase 2 | Cut from Phase 1 scope on 2026-05-13 to reduce complexity and integration risk. Five files modified to remove NetSuite plumbing; six "Phase 2 hook" references intentionally retained. Full restoration record in `docs/netsuite-deferred.md`. |
| **M4 — Marts + transform** | 🟡 Marts created (empty), transform untested | Migrations 005-008 applied. `marts.dim_customer`, `marts.whales`, `marts.lapsed`, `marts.reorder_due`, `marts.kpi_overview`, `marts.rfm_segments`, `marts.company_health` exist as empty materialized views. `marts.inventory_status` removed with NetSuite cut. Transform cron route untouched (will populate marts once raw HubSpot data lands). |
| **M5 — Auth + cutover** | 🔴 Decision pending | Original plan was Postgres facade impl + 8-item security pass + cutover. Reframed: auth approach is now a decision Freddie needs to weigh in on — current shared-password gate isn't suitable for live customer data. Two options proposed: (A) HubSpot OAuth using existing CRM identities, (B) magic-link via Resend with email allowlist. Recommendation: A. ~4-5 hrs implementation once decided. |
| **M6 — Insights cron** | ❌ Not started | Defers until marts are populated (after M2 ingest works + M4 transform runs). |

**Auth caveat:** the dashboard currently uses a single shared password (`WHALE_PASSWORD` env var, fallback hardcoded as `gtse2026` in middleware.ts). Vercel's $150/mo "Advanced Deployment Protection" was rejected — the engineering cost of HubSpot OAuth pays for itself inside one year AND adds per-user accountability that Vercel's option doesn't.

**Dormant ≠ untested.** Every commit still passes `pnpm typecheck`, `pnpm test` (18/18), and `pnpm build`. Cron routes still return 401 without `CRON_SECRET`.

---

## Phase 0 status

**Most NetSuite-specific Phase 0 questions are moot** now that NetSuite is deferred to Phase 2. Remaining HubSpot-specific markers in the codebase:

```bash
grep -rn "// PHASE 0:" lib/ db/migrations/
grep -rn "-- PHASE 0" db/migrations/
```

Active markers (need answers before live data goes through):
- **§A1** — exact HubSpot deal stage value meaning "closed-won / shipped." Defaults to `'closedwon'` in `staging.fact_order_lines`.
- **§A2** — HubSpot line-item property carrying SKU code. Defaults to `hs_sku` in `pull-line-items.ts` and `staging.fact_order_lines`.
- **§A3** — confirm HubSpot Company property containing region (UK/US). Currently derived from `country` in `staging.customer`.
- **§A4** — confirm `industry` property values + taxonomy (HubSpot standard / GTSE custom / SIC).

Most of these are one-line property-name confirmations once GTSE's HubSpot configuration is inspected. Deferred NetSuite markers (§A6, §B6, §B7) are now Phase 2 concerns — see `docs/netsuite-deferred.md`.

---

## Judgment calls flagged for review

1. **`marts.dim_customer`'s engagement-derived columns surface as `NULL`.** `last_engagement_date`, `email_opens_l60d`, `active_contacts` are placeholder NULLs. Engagement ingestion is **parked for Phase 2** (2026-05-13) because the HubSpot service key was scoped for companies/contacts/deals/line_items/owners only — granting `crm.objects.{emails,calls,meetings,notes,tasks}.read` would be needed first. Phase 1 substitute: `hs_last_activity_date` is now pulled on Company records (`pull-companies.ts`), giving a lighter "last activity" signal without engagement scopes. See `lib/ingest/pull-engagements.ts` for the full Phase 2 restoration plan.

2. **`top_3_reorder_skus` and `top_3_cross_sell_skus` are `ARRAY[]::text[]`.** Per-customer SKU aggregation + peer-basket lift analysis is non-trivial SQL. Placeholder empty arrays keep the type stable. Real fix: dedicated `marts.customer_top_skus` view + `marts.cross_sell_candidates` view.

3. **NetSuite removal — six "Phase 2 hooks" intentionally retained.** The `raw_netsuite` schema (empty), `ns_customer_id` NULL passthrough columns in `staging.customer` and `marts.dim_customer`, and the `netsuite_customer_id` reference in `pull-companies.ts`'s property list are all preserved deliberately so Phase 2 restoration is a smaller diff. **Do not remove these as part of dead-code cleanup.** See `docs/netsuite-deferred.md` for the full list.

4. **Engagements aren't pruned by retention.** `app.fn_retention_cleanup()` now prunes only `ingestion_runs` (90 days) and `api_access_log` (90 days). The NetSuite inventory snapshot pruning was removed with the NetSuite cut. Engagements (if ever ingested in Phase 2) stay indefinitely because PII is already stripped at ingestion. If GDPR comes calling we'd add explicit per-record deletion.

---

## Deferred (with reasons)

| Item | Status / why deferred |
|---|---|
| **Neon provisioning** | ✅ Done. `neon-cyclamen-basket` connected to project. |
| **HubSpot token** | 🟡 Created but currently 401s — rotation didn't take effect or token in `.env.local` is stale. Needs Matt to verify in HubSpot. |
| **`CRON_SECRET`** | ❌ Not yet generated. Needed before triggering the cron route via HTTP. Generate with `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` and add to Vercel + `.env.local`. |
| **`vercel.json` cron entries** | ❌ Wait until ingest works manually + auth is in place. Activating crons before auth = real customer data hitting the warehouse behind a shared password. |
| **NetSuite (M3)** | ⏸️ Deferred to Phase 2. See `docs/netsuite-deferred.md`. |
| **Auth upgrade (M5 part 1)** | 🔴 Decision pending Freddie. Recommendation: HubSpot OAuth. |
| **Postgres facade cutover (M5 part 2)** | Wait until auth is in place + marts are populated. Flip `DATA_SOURCE` env from `memory` to `postgres`. |
| **Insights cron (M6)** | Wait until marts are populated. |

---

## Next concrete actions

The build is gated on three things, in order:

### 1. Fix HubSpot token (Matt's action, ~5 min)
Token in `.env.local` is `pat-eu1-67ef3dc9-...` — same as the value originally pasted in chat. HubSpot returns 401 on direct curl, suggesting the rotation didn't take effect or `.env.local` has the pre-rotation value. To unblock:

- Open HubSpot → Legacy Apps → "Project Whale — Read Only" → view current active token
- If it matches what's in `.env.local`, click Rotate / Reset to actually regenerate
- Paste the active value into `.env.local` (replace the existing line)
- Also re-add to Vercel: `vercel env rm HUBSPOT_PRIVATE_APP_TOKEN production --yes; vercel env add HUBSPOT_PRIVATE_APP_TOKEN production` (interactive paste at prompt)

Verify with: `pnpm tsx --env-file=.env.local scripts/test-hubspot-token.ts` — expect HTTP 200.

### 2. Smoke test ingest + transform (~15 min, mostly automated)
Once the token returns 200:

```powershell
# Pull a fresh batch of companies into raw_hubspot
pnpm tsx --node-options="--conditions=react-server" --env-file=.env.local scripts/test-ingest-companies.ts
```

Then trigger the transform cron locally (after generating CRON_SECRET).

### 3. Decide on auth (Freddie's call)
Two options on the table:
- **HubSpot OAuth** — sign in with existing HubSpot accounts (~4-5 hrs implementation)
- **Magic-link email auth** via Resend with `@gtse.com` allowlist (~2-3 hrs)

Either gets implemented before `DATA_SOURCE` is flipped to `postgres` for the deployed app.

### Then: cutover sequence
1. Implement chosen auth path
2. Test thoroughly with internal users
3. Manually trigger first full HubSpot ingest against Neon
4. Manually trigger transform — verify all 7 marts populate
5. Flip `DATA_SOURCE=postgres` env var
6. Add cron schedule entries (`vercel.json`)
7. Rotate `WHALE_PASSWORD` (already burnt in committed planning docs)
8. Invite users

---

## Repo state

**`main` deploys to <https://gtse-demo-dashboard.vercel.app>** automatically. Current user-visible state: still the demo dashboard reading mock data (`DATA_SOURCE=memory`), behind the shared-password gate. Real data is in Neon but not yet exposed to the dashboard.

Files materially changed this session (2026-05-13):
- `db/migrations/004_raw_netsuite.sql` → stubbed
- `db/migrations/005_staging.sql` → removed `staging.sku`
- `db/migrations/006_functions.sql` → fixed EXTRACT bug + bigint signature
- `db/migrations/007_marts.sql` → removed `marts.inventory_status`
- `db/migrations/008_retention.sql` → removed NetSuite snapshot cleanup
- `app/api/cron/ingest-hubspot/route.ts` → commented out engagement pull
- `app/api/cron/transform/route.ts` → removed `inventory_status` from refresh list
- `app/settings/page.tsx`, `app/api/v1/route.ts` → "HubSpot and NetSuite" → "HubSpot"
- `lib/db/{postgres-pool,neon-http,migrate}.ts` + `scripts/{inspect-db,migrate}.ts` → accept both `DATABASE_*` and `POSTGRES_*` naming
- `lib/db/migrate.ts` → removed `server-only` import (for tsx compatibility)
- `lib/ingest/pull-companies.ts` → added `hs_last_activity_date`
- `lib/ingest/pull-engagements.ts` → added "PARKED FOR PHASE 2" header
- New: `scripts/reset-db.ts`, `scripts/test-ingest-companies.ts`, `scripts/test-hubspot-token.ts`
- New: `docs/netsuite-deferred.md`

---

## Things that could trip you up

- **`pnpm` commands need `cd /c/AI_Project/GTSE/project-whale-mockup &&` first.** I burned 5 minutes today by running `pnpm add` from the parent dir, which created stray `package.json` + `node_modules/` at `C:\AI_Project\GTSE\`. Bash tool's pwd reverts more often than the system prompt suggests.
- **`vercel.json` does not yet exist in the repo.** Master plan templates assume it exists — when activating crons, you'll create it. The first cron entry should be `/api/cron/ingest-hubspot` at `0 2 * * *` UTC.
- **The `docs/phase-0-question-guide.md` file is untracked.** Matt wrote it earlier today; I haven't been told to commit. Leave alone unless he says.
- **Matt's `WHALE_PASSWORD = gtse2026` is committed in the master plan + visible to anyone with repo access.** Master plan §10.3 mandates rotating before real-data cutover. This is the only point at which I'm authorised to change `WHALE_PASSWORD` per master plan §13.5.
- **`--env-file=.env.local`** in `pnpm db:migrate` requires Node 20+. Should work on Vercel + most local dev environments; flag if you hit `unrecognised flag`.

---

## Change log

| Date | Change |
|---|---|
| 2026-05-13 | **NetSuite cut from Phase 1**, deferred to Phase 2 (`docs/netsuite-deferred.md`). Neon `neon-cyclamen-basket` connected to project, all 8 migrations applied (after fixing 2 SQL bugs in 006 + dropping NetSuite-dependent objects from 007 and 008). HubSpot Private App created but current token returns 401 — rotation issue. Engagement ingest parked for Phase 2 (scope mismatch). Auth upgrade decision pending Freddie. Reframed M5 around auth strategy. |
| 2026-05-08 | Initial state-of-play doc covering M1 (live), M2/M4 (dormant), M3/M5/M6 (not started). Three judgment calls flagged for review. Tomorrow's CP-2 path documented. |
