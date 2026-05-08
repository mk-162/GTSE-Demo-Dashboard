# Project Whale — Operations Runbook

**Audience:** the engineer on call when the dashboard breaks, a token rotation comes due, or a cron run fails.

**Scope:** post-cutover steady state. Pre-cutover (`DATA_SOURCE=memory`) the dashboard reads in-memory mock data and these procedures don't apply.

This is a working document — when you fix something not covered here, append the procedure.

---

## 0. Cheat sheet

| If you need to… | Run / look at |
|---|---|
| **Roll back to mock data immediately** | `vercel env rm DATA_SOURCE production --yes && vercel deploy --prod --yes` (~3 min, no code change) |
| Trigger HubSpot ingestion manually | `curl -H "Authorization: Bearer $CRON_SECRET" https://gtse-demo-dashboard.vercel.app/api/cron/ingest-hubspot` |
| Trigger NetSuite ingestion manually | `curl -H "Authorization: Bearer $CRON_SECRET" https://gtse-demo-dashboard.vercel.app/api/cron/ingest-netsuite` |
| Trigger transform manually | `curl -H "Authorization: Bearer $CRON_SECRET" https://gtse-demo-dashboard.vercel.app/api/cron/transform` |
| Trigger insights manually | `curl -H "Authorization: Bearer $CRON_SECRET" https://gtse-demo-dashboard.vercel.app/api/cron/insights` |
| See recent cron runs | `psql "$DATABASE_URL_UNPOOLED" -c "SELECT source, status, started_at, finished_at, rows_ingested FROM app.ingestion_runs ORDER BY started_at DESC LIMIT 20"` |
| See API access in last hour | `psql "$DATABASE_URL_UNPOOLED" -c "SELECT route, status, count(*) FROM app.api_access_log WHERE logged_at > now() - interval '1 hour' GROUP BY route, status ORDER BY count DESC"` |
| Force a mart rebuild | Same as transform manual trigger above |
| Apply pending migrations locally | `vercel env pull .env.local && pnpm db:migrate` |

---

## 1. Environment variables

The dashboard depends on the following env vars. All are set on Vercel for the `gtse-demo-dashboard` project. **Never** commit any of them.

| Var | Purpose | Required for |
|---|---|---|
| `WHALE_PASSWORD` | Dashboard UI cookie gate | All dashboard reads |
| `WHALE_API_TOKEN` | Public REST API (`/api/v1/*`) Bearer token | External AI tools, Settings page test button |
| `CRON_SECRET` | Authenticates Vercel-scheduled crons | All `/api/cron/*` invocations |
| `ANTHROPIC_API_KEY` | gBot + insight regeneration + nightly insight cron | Chat panel, regenerate button, insights cron |
| `DATABASE_URL` | Auto-set by Neon Marketplace integration. Pooled connection string. | All Postgres reads from Edge runtime (`/api/chat`, `/api/insights/regenerate`) |
| `DATABASE_URL_UNPOOLED` | Auto-set by Neon. Direct connection (no PgBouncer). | All Postgres writes + migrations |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot CRM read access | `/api/cron/ingest-hubspot` |
| `NETSUITE_ACCOUNT_ID` + auth-specific vars | NetSuite REST Web Services access. OAuth 2.0 path: `NETSUITE_CLIENT_ID`, `NETSUITE_CERT_ID`, `NETSUITE_PRIVATE_KEY`. TBA path: `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET`, `NETSUITE_TOKEN_ID`, `NETSUITE_TOKEN_SECRET`. | `/api/cron/ingest-netsuite` |
| `ALLOWED_ORIGINS` | CORS allow-list for `/api/v1/*`. Comma-separated. | Cross-origin browser callers |
| `DATA_SOURCE` | `memory` or `postgres`. Controls which facade impl the data layer loads. | Switching between mock + live data |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Per-IP rate limits via `@upstash/ratelimit` | `/api/v1/*` and `/api/chat` rate limiting |

**Pulling env locally:** `vercel env pull .env.local` writes the production set into `.env.local` (gitignored). Use this before `pnpm db:migrate` or any local testing that needs DB access.

---

## 2. Token rotation

Tokens expire on a schedule **and** rotate immediately on suspicion of compromise. Procedures below are sequential — finish each step before moving on.

### 2.1 `WHALE_API_TOKEN` — every 90 days, or immediately on suspicion

External tools (Cowork, custom GPTs) use this. Rotation breaks any tool that has the old value cached.

```bash
# 1. Generate the new value
NEW_TOKEN=$(openssl rand -hex 16)
echo "$NEW_TOKEN"   # save this somewhere secure NOW — you'll need it

# 2. Set on Vercel (production scope only — preview/dev get the old value
#    until rotation propagates manually)
vercel env rm WHALE_API_TOKEN production --yes
printf "$NEW_TOKEN" | vercel env add WHALE_API_TOKEN production

# 3. Redeploy so the new env is live
vercel deploy --prod --yes

# 4. Verify the new token works
curl -H "Authorization: Bearer $NEW_TOKEN" \
  "https://gtse-demo-dashboard.vercel.app/api/v1/top-whales?n=1"
# Expect: 200 + JSON

# 5. Verify the OLD token is rejected
curl -H "Authorization: Bearer $OLD_TOKEN" \
  "https://gtse-demo-dashboard.vercel.app/api/v1/top-whales?n=1"
# Expect: 401 invalid_token

# 6. Notify each external consumer of the new token (1Password share,
#    Slack DM — never email, never commit message)
```

**On suspicion of compromise:** skip the schedule, run steps 1-5 immediately, audit `app.api_access_log` for the compromised token's prefix.

### 2.2 `CRON_SECRET` — every 180 days

Used only by Vercel cron + manual triggers. No external consumers. Rotation has zero downstream impact.

```bash
NEW_SECRET=$(openssl rand -hex 16)
vercel env rm CRON_SECRET production --yes
printf "$NEW_SECRET" | vercel env add CRON_SECRET production
vercel deploy --prod --yes

# Verify by triggering a cron manually with the new value
curl -H "Authorization: Bearer $NEW_SECRET" \
  https://gtse-demo-dashboard.vercel.app/api/cron/transform
# Expect: 200 + { ok: true, ... }
```

### 2.3 `HUBSPOT_PRIVATE_APP_TOKEN` — every 180 days, HubSpot admin required

Tokens are scoped per-app, generated in HubSpot's settings.

```
1. Log into HubSpot as an admin
2. Settings → Integrations → Private Apps
3. Open the "Project Whale" app (or whatever name you used)
4. Click "Rotate access token" — HubSpot generates a new value
5. Copy the new token
6. On Vercel:
   vercel env rm HUBSPOT_PRIVATE_APP_TOKEN production --yes
   printf "$NEW_TOKEN" | vercel env add HUBSPOT_PRIVATE_APP_TOKEN production
   vercel deploy --prod --yes
7. Trigger ingest-hubspot manually:
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://gtse-demo-dashboard.vercel.app/api/cron/ingest-hubspot
   Expect: 200 + counts
8. The old token is auto-invalidated by HubSpot — no extra step
```

### 2.4 NetSuite auth credentials — every 180 days, NetSuite admin required

Procedure differs by auth path (OAuth 2.0 vs TBA — see Phase 0 §B1).

**OAuth 2.0 path:**
```
1. NetSuite admin generates a NEW certificate / private key pair locally
2. Upload the new public cert in NetSuite (Setup → Integration → OAuth 2.0
   Client Credentials Setup → Add Cert). Note the new Cert ID.
3. On Vercel, update NETSUITE_CERT_ID and NETSUITE_PRIVATE_KEY:
   vercel env rm NETSUITE_CERT_ID production --yes
   vercel env rm NETSUITE_PRIVATE_KEY production --yes
   printf "$NEW_CERT_ID" | vercel env add NETSUITE_CERT_ID production
   # Use --force to handle the multi-line PEM:
   printf "$NEW_PRIVATE_KEY_PEM" | vercel env add NETSUITE_PRIVATE_KEY production
4. Redeploy: vercel deploy --prod --yes
5. Trigger ingest-netsuite manually to confirm
6. Once confirmed, remove the old cert in NetSuite
```

**TBA path:**
```
1. NetSuite admin generates a new Access Token in NetSuite
   (Setup → Users/Roles → Access Tokens → New)
2. Note the new Token ID + Token Secret
3. On Vercel:
   vercel env rm NETSUITE_TOKEN_ID production --yes
   vercel env rm NETSUITE_TOKEN_SECRET production --yes
   printf "$NEW_TOKEN_ID" | vercel env add NETSUITE_TOKEN_ID production
   printf "$NEW_TOKEN_SECRET" | vercel env add NETSUITE_TOKEN_SECRET production
4. Redeploy + verify with manual cron trigger
5. Revoke the old token in NetSuite once confirmed
```

### 2.5 `WHALE_PASSWORD` — on demand

The dashboard cookie gate. Rotate when the audience list changes (people leaving, new shared credential).

```bash
NEW_PASSWORD=$(openssl rand -hex 12)  # human-readable enough
vercel env rm WHALE_PASSWORD production --yes
printf "$NEW_PASSWORD" | vercel env add WHALE_PASSWORD production
vercel deploy --prod --yes
# Notify the demo audience out-of-band (1Password, Slack DM)
```

After rotation, anyone with the old cookie will be redirected to `/login` next time they hit any protected page.

---

## 3. Cron failure modes

Vercel cron invokes production deployments only and **does not retry on failure**. A 500 from a cron route is logged in Vercel function logs but doesn't auto-page anyone — you'll spot it via:
1. The dashboard showing stale data (if multiple consecutive failures)
2. `SELECT * FROM app.ingestion_runs WHERE status = 'failed'` returning recent rows
3. Vercel's Functions tab showing repeated 500s

### 3.1 `/api/cron/ingest-hubspot` failure

Most common causes:
- **HubSpot rate limit hit.** The Private App SDK has built-in retry (3 attempts), but a sustained rate limit will exhaust them. Check `errors->>'message'` — look for "429" or "retried 3 times".
  - **Fix:** rerun manually after waiting 5-10 minutes. If chronic, switch the cron to per-object-type splitting (one cron per object).
- **Token expired or revoked.** `errors` shows "401" or "Invalid token".
  - **Fix:** rotate per §2.3.
- **Sensitive Data flag turned on.** Engagement reads return 403; cron fails on `pull-engagements`.
  - **Fix:** ask HubSpot admin to turn it off (per Phase 0 §A8). Workaround: temporarily comment out `pullHubSpotEngagements()` in the cron orchestrator if engagement data is dispensable.
- **Property missing from HubSpot Company.** Cron succeeds but `staging.customer.ns_customer_id` comes back NULL for affected rows; downstream marts have join gaps.
  - **Fix:** add the property in HubSpot, backfill from NetSuite, re-ingest.

### 3.2 `/api/cron/ingest-netsuite` failure

Most common causes:
- **Auth signature failure (TBA path).** `errors` shows "401" + "InvalidSignature".
  - Verify clock drift: NetSuite rejects timestamps > 5 minutes off UTC. Vercel functions are synced.
  - Check that all 5 TBA env vars are set + non-empty.
  - Verify Consumer Secret / Token Secret encoding — newlines or trailing whitespace break HMAC.
- **JWT signing failure (OAuth 2.0 path).** `errors` shows "InvalidJWT" or "Algorithm not supported".
  - Verify `NETSUITE_PRIVATE_KEY` is the full PEM (BEGIN/END markers + base64 + linebreaks).
  - Verify the cert is uploaded + active in NetSuite (admin check).
  - Algorithm must be RS256 or PS256 — never HS256 for OAuth 2.0 in NetSuite.
- **REST Web Services not enabled.** `errors` shows "Service unavailable" or 404 on the SuiteQL endpoint.
  - Ask NetSuite admin to enable under Setup → Company → Enable Features → SuiteCloud.
- **SuiteQL syntax error after a NetSuite version upgrade.** Rare but possible — Oracle deprecates fields between releases.
  - Compare the failing query against current NetSuite docs for the relevant table.

### 3.3 `/api/cron/transform` failure

Refresh time should be <60 seconds (per master plan §9.5 acceptance).

Most common causes:
- **`marts.dim_customer` empty after refresh.** Cron route raises explicitly. Means staging joins produced nothing.
  - Check that `raw_hubspot.deals` and `raw_hubspot.assoc_deal_company` have rows.
  - Check the deal stage filter in `staging.fact_order_lines` — Phase 0 §A1 confirms the value, but a NetSuite-side stage rename can break it silently.
  - Check that `staging.customer.ns_customer_id` resolves for the deal's company — if NULL, the join drops the row.
- **`REFRESH MATERIALIZED VIEW CONCURRENTLY` errors.** Each mart needs a UNIQUE INDEX (defined in `007_marts.sql`).
  - If you ever add a new mart, ensure `CREATE UNIQUE INDEX` is in the same migration.
- **Refresh time crept past 60s.** Typically because `staging.fact_order_lines` got large. Postgres should still handle it, but if it spirals:
  - Add a `WHERE order_date > now() - interval '5 years'` clamp in `staging.fact_order_lines`.
  - Or partition `staging.fact_order_lines` by year.

### 3.4 `/api/cron/insights` failure

The route catches per-call errors and only fails the whole cron if every call failed (per silent-failure-hunter wisdom). Partial success returns 200 with `results: [{ ok: false, ... }]` entries.

Most common causes:
- **Anthropic API outage.** Look for `errors->>'message'` containing "429" (rate limit) or "503" (upstream).
  - Anthropic publishes status at <https://status.anthropic.com>. If sustained, no fix from our side; let the next cron retry.
- **`ANTHROPIC_API_KEY` missing.** Route returns 503 "AI not configured" before any call.
  - Set the env var (it should already be set; if missing, ask whoever owns Anthropic billing).
- **`buildInsightPrompt` returns null** for an unknown insight type. Means the type list in the cron drifted from the prompts in `lib/ai-context.ts`. Sync them.

---

## 4. Production cutover and rollback

### 4.1 Cutover (M5)

Done once, by a human, after CP-4 (contract tests green against all three impls).

```bash
# Confirm Phase 0 + Neon + ingestion are all healthy
psql "$DATABASE_URL_UNPOOLED" -c "
  SELECT count(*) AS dim_customer_rows FROM marts.dim_customer;
  SELECT region, count(*) FROM marts.dim_customer GROUP BY region;
"

# Set DATA_SOURCE=postgres on production
printf "postgres" | vercel env add DATA_SOURCE production
vercel deploy --prod --yes

# Verify
curl -H "Authorization: Bearer $WHALE_API_TOKEN" \
  "https://gtse-demo-dashboard.vercel.app/api/v1/top-whales?region=UK&n=3" \
  | jq '.whales[].name'
# Should return real account names — not "Sheffield Steelworks", "Birmingham
# Engineering" etc. from the mock data.
```

### 4.2 Rollback (instant — no code change)

If anything looks wrong after cutover:

```bash
vercel env rm DATA_SOURCE production --yes
vercel deploy --prod --yes
# Dashboard back on memory impl in ~2-3 minutes
```

This is the most important risk mitigation in the project — protect it. The
in-memory impl must always work as fallback. If you find yourself making
changes that break it, stop and rethink.

### 4.3 Schema rollback

There is no automatic schema rollback. Migrations are forward-only and idempotent. If a migration applied data corruption:

1. Drop the affected mart: `DROP MATERIALIZED VIEW marts.X CASCADE`
2. Fix the migration SQL in `db/migrations/00X_*.sql`
3. Remove the migration from the tracking table:
   `DELETE FROM app.migrations WHERE id = '00X_name'`
4. `pnpm db:migrate` re-applies

Never edit a migration that has already run on production without coordinating a corresponding tracking-table delete + re-apply.

---

## 5. Useful queries

### Recent cron health
```sql
SELECT
  source,
  status,
  started_at AT TIME ZONE 'UTC' AS started_utc,
  finished_at - started_at AS duration,
  rows_ingested
FROM app.ingestion_runs
ORDER BY started_at DESC
LIMIT 20;
```

### Per-source success rate (last 7 days)
```sql
SELECT
  source,
  count(*) FILTER (WHERE status = 'success')::float / count(*) * 100 AS success_pct,
  count(*) AS total_runs
FROM app.ingestion_runs
WHERE started_at > now() - interval '7 days'
GROUP BY source;
```

### Recent failures with messages
```sql
SELECT source, started_at, errors->>'message' AS error
FROM app.ingestion_runs
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 10;
```

### Cursor positions (how fresh is each source?)
```sql
SELECT source, object_type, cursor_value, now() - cursor_value AS lag
FROM app.ingestion_cursors
ORDER BY source, object_type;
```

### Mart row counts
```sql
SELECT 'dim_customer' AS m, count(*) FROM marts.dim_customer
UNION ALL SELECT 'whales',           count(*) FROM marts.whales
UNION ALL SELECT 'lapsed',           count(*) FROM marts.lapsed
UNION ALL SELECT 'reorder_due',      count(*) FROM marts.reorder_due
UNION ALL SELECT 'kpi_overview',     count(*) FROM marts.kpi_overview
UNION ALL SELECT 'rfm_segments',     count(*) FROM marts.rfm_segments
UNION ALL SELECT 'company_health',   count(*) FROM marts.company_health
UNION ALL SELECT 'inventory_status', count(*) FROM marts.inventory_status;
```

### API access by token prefix (last 24h)
```sql
SELECT token_prefix, count(*), array_agg(DISTINCT route) AS routes
FROM app.api_access_log
WHERE logged_at > now() - interval '24 hours'
GROUP BY token_prefix
ORDER BY count DESC;
```

### Spot-check a customer vs HubSpot UI
```sql
SELECT id, name, region, ltm_revenue, last_order_date, lapse_ratio, health_band
FROM marts.dim_customer
WHERE name ILIKE '%sheffield%';
```

---

## 6. Recovery playbooks

### "Dashboard is showing stale data"

1. Check most recent cron runs: are they all `status = 'success'` recently?
2. If failed: see §3 for cause-specific fix.
3. If successful but old: trigger transform manually (cheat sheet §0). The dashboard reads materialised views; if those weren't refreshed, the data IS old until refresh.

### "Whole dashboard is 500'ing"

1. Check `vercel inspect <production-deployment-id> --logs` for the last few requests.
2. If `DATABASE_URL not set` errors: confirm Neon is still attached (Vercel dashboard → Storage). Re-attach if accidentally detached.
3. If "Edge runtime cannot import postgres" errors: a Server Component or API route imported from `lib/db/postgres-pool.ts` from an Edge route. Find the offending import and fix the runtime split (see master plan §4.6).
4. **Last resort:** rollback to mock data per §4.2.

### "External consumer reports 401 / 403"

1. Confirm their `Authorization: Bearer <token>` matches `WHALE_API_TOKEN` exactly. Check for trailing whitespace, copy-paste of "Bearer ..." literally, etc.
2. If recently rotated, confirm they have the new value.
3. If `?token=` query-string fallback was being used: that's removed in production by design (master plan §10.3 item 2). Tell the consumer to use the header.

### "AI insights are stale or missing on a dashboard page"

1. Check `app.dashboard_insights` for the relevant `(insight_type, region)`:
   ```sql
   SELECT generated_at, length(body_markdown) FROM app.dashboard_insights
   WHERE insight_type = 'whale_attention' AND region = 'UK'
   ORDER BY generated_at DESC LIMIT 3;
   ```
2. If old: trigger insights cron manually (cheat sheet §0).
3. If empty: see §3.4.

---

## 7. Change log

| Date | Change |
|---|---|
| 2026-05-08 | Initial runbook — token rotation, cron failure modes, cutover/rollback, recovery playbooks. Written before Phase 0 ⇒ NetSuite procedures are path-agnostic; will refine once Phase 0 selects OAuth 2.0 vs TBA. |
