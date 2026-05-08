# Project Whale — Build state

**As of 2026-05-08 evening.** This doc tracks where the build is, what's dormant, and what tomorrow's first action is. Pair with [`runbook.md`](./runbook.md) (operational procedures) and the master plan (`C:\AI_Project\GTSE\project-whale-master-plan.md`, the technical contract).

When you (or a fresh agent) resume work, read this first to orient — then `git log --oneline -5` to confirm the commits below are still on `main`.

---

## Milestone progress

| Milestone | Status | What's there |
|---|---|---|
| **M1 — Server data facade** | ✅ Live in production | `lib/data/` with DataLayer interface + memoryImpl + postgres-{edge,node} stubs. 18/18 contract tests green. All pages refactored to Server Component shell + Client Component view. Region migrated to cookie. |
| **M2 — Neon + HubSpot ingestion** | 🟡 Dormant — code committed, not running | `lib/db/{neon-http,postgres-pool,migrate}.ts`. Migrations 001-004 (schemas, raw_hubspot, app, raw_netsuite). `lib/ingest/*` HubSpot pulls + associations. `/api/cron/ingest-hubspot` route. Cron not scheduled in `vercel.json`; auth-gated so dormant. |
| **M3 — NetSuite ingestion** | ❌ Not started | Auth path is a Phase 0 §B1 decision. Writing OAuth 2.0 vs TBA on a guess wastes effort. |
| **M4 — Marts + transform** | 🟡 Dormant — code committed, not running | Migrations 005-008 (staging views, SQL functions, 8 marts, retention cleanup). `/api/cron/transform` route. Same dormant-by-default treatment as M2. |
| **M5 — Postgres facade impls + security + cutover** | ❌ Not started | Postgres impls would mechanically port from `memoryImpl` but can't be validated without populated marts. Security pass (8 items §10.3) gates production cutover. |
| **M6 — Insights cron** | ❌ Not started (one polish item shipped) | Settings page copy fix (Airbyte/BigCommerce → HubSpot/NetSuite via Vercel Cron) merged in `0b01550`. Insights cron itself defers until M5 cutover so the dashboard reads from `app.dashboard_insights`. |

**Dormant ≠ untested.** Every dormant commit passes `pnpm typecheck`, `pnpm test` (18/18), and `pnpm build`. The cron routes return 401 if `CRON_SECRET` is unset (they will be, in production until set), so accidental invocation is harmless.

---

## Phase 0 status

**Outstanding.** Matt is trying to answer tomorrow. Until then, M2/M4 stay dormant.

- The questions live in two places:
  - `C:\AI_Project\GTSE\phase-0-questions.md` — concise, paste-ready stakeholder hand-off (~2 pages, split by audience)
  - `docs/phase-0-question-guide.md` (this repo) — comprehensive interview guide with capture structure (788 lines)
- The answers will land in `C:\AI_Project\GTSE\phase-0-findings.md`. **That file does not exist yet** — its absence is the gate signal.
- Matt explicitly authorised progressing dormant infra without Phase 0 answers (see commits `6b712ec` and `0b01550`). All Phase-0-dependent strings in the codebase are marked with `// PHASE 0:` comments — search for these tomorrow:

```bash
grep -rn "// PHASE 0:" lib/ db/migrations/
grep -rn "-- PHASE 0" db/migrations/
```

There are roughly a dozen markers across `lib/ingest/pull-*.ts` and `db/migrations/005_staging.sql`. Most are one-line property-name confirmations.

---

## Three judgment calls flagged in commit `0b01550`

These are areas where I made a defensible-but-reviewable decision in the M4 SQL. Worth a glance tomorrow before activating:

1. **`marts.dim_customer`'s engagement-derived columns surface as `NULL`.** `last_engagement_date`, `email_opens_l60d`, `active_contacts` need a `staging.engagement` view that depends on Phase 0 confirming engagement property names. Until then, `dim_customer` returns NULL for these. The dashboard's account detail page tolerates NULL — renders "—" rather than failing. Real fix: M2.5, write `staging.engagement` view + add `LEFT JOIN` to `dim_customer`.

2. **`top_3_reorder_skus` and `top_3_cross_sell_skus` are `ARRAY[]::text[]`.** Per-customer SKU aggregation + peer-basket lift analysis is non-trivial SQL. For tonight, placeholder empty arrays keep the type stable. Real fix: dedicated `marts.customer_top_skus` view aggregating from `staging.fact_order_lines` + a `marts.cross_sell_candidates` view doing the peer-basket join.

3. **Engagements aren't pruned by retention.** `app.fn_retention_cleanup()` prunes `ingestion_runs` (90 days), `api_access_log` (90 days), and `inventory_snapshots` (180 days). Engagements stay indefinitely because PII is already stripped at ingestion (master plan §10.3 item 5: email body + attachment IDs gone before they hit the DB). If GDPR comes calling we should add explicit per-record deletion via a separate function; blanket pruning would lose useful long-tail signal.

---

## Deferred (with reasons)

| Item | Why deferred |
|---|---|
| **Neon provisioning** | Billed resource (~£12-16/month). Matt's one-click in Vercel Marketplace. |
| **HubSpot token + CRON_SECRET** | Matt generates and sets on Vercel. |
| **`vercel.json` cron entries** | Adding the schedule activates the cron. Without env vars set, scheduled cron would 500 noisily at 02:00 UTC. Activate when Neon + tokens land. |
| **NetSuite (M3)** | Auth path is Phase 0 §B1 decision. |
| **Postgres facade impls (M5 §10.1)** | Mechanical port from `memoryImpl` (~150 lines) but can't be validated without populated marts — bugs would lurk until cutover. |
| **M5 security partial** | `WHALE_API_TOKEN` fail-closed and CORS allow-list deploy-break the existing demo if env vars aren't set first. Wire up alongside M5 cutover. |
| **Insights cron (M6 §11.1)** | Writes to `app.dashboard_insights`; nothing reads from there until M5 cutover. Premature. |

---

## Tomorrow's tightest path to CP-2

CP-2 = raw HubSpot data flowing in `raw_hubspot.*`. Total ~30 minutes from a clean Phase 0 start, *if* Matt's inputs are ready:

1. **Matt provisions Neon** (Vercel → Storage → Marketplace → Neon → Add). ~5 min. Auto-sets `DATABASE_URL` + `DATABASE_URL_UNPOOLED`.
2. **Matt sets `HUBSPOT_PRIVATE_APP_TOKEN` + `CRON_SECRET` on Vercel.** ~5 min. (Generate `CRON_SECRET` with `openssl rand -hex 16`.)
3. **Patch `// PHASE 0:` markers** to actual values from `phase-0-findings.md`. ~10 min. Mostly one-line property-name swaps in `lib/ingest/pull-companies.ts` and `db/migrations/005_staging.sql`.
4. **Add cron entries to `vercel.json`** (just M2's HubSpot for now; transform comes after CP-2):
   ```json
   { "crons": [
     { "path": "/api/cron/ingest-hubspot", "schedule": "0 2 * * *" }
   ] }
   ```
   ~2 min. Push.
5. **Apply migrations locally** to confirm the SQL is sound:
   ```
   vercel env pull .env.local
   pnpm db:migrate
   ```
   ~30 sec.
6. **Trigger ingestion manually** from local against production:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://gtse-demo-dashboard.vercel.app/api/cron/ingest-hubspot
   ```
   ~3-5 min for first run. Watch `app.ingestion_runs` for `status='success'`.
7. **Spot-check** raw_hubspot.companies for row count + a known account name. ~5 min.

**That gets to "raw HubSpot data flowing." After that:**
- **NetSuite (M3)** — once Phase 0 §B1 selects an auth path, ~3-4 hours to write the client + 6 pull modules + cron.
- **Activate transform cron** — add `vercel.json` entry, manually trigger to populate marts. ~5 min.
- **CP-3** spot-check 3 accounts in `marts.dim_customer` vs HubSpot UI per master plan §9.5.

---

## Repo state at end of 2026-05-08

```
$ git log --oneline -5 main
0b01550 M4 SQL + transform cron + runbook + db:migrate CLI (all dormant)
6b712ec M2 infra (dormant): Postgres clients, schema migrations, HubSpot ingestion
f1ffc96 Milestone 1: server data facade with mock implementation
055f6f2 Rename 'Ask Whale' to 'gBot' in chat button + panel header
95df26a Add Settings page + public REST API (/api/v1/*) for AI integrations
```

**`main` deploys to <https://gtse-demo-dashboard.vercel.app>** automatically. The only user-visible change since the start of 2026-05-08 is the Settings page "Direct database access" tab now mentions HubSpot+NetSuite via Vercel Cron instead of Airbyte+BigCommerce. Everything else is dormant infrastructure that hasn't activated.

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
| 2026-05-08 | Initial state-of-play doc covering M1 (live), M2/M4 (dormant), M3/M5/M6 (not started). Three judgment calls flagged for review. Tomorrow's CP-2 path documented. |
