# Project Whale — mock-up dashboard

Polished, visually convincing mock-up of the **Project Whale** customer-intelligence dashboard for GTSE Hub. Designed to be shown to the CEO so he can see the shape of what's being proposed before any data plumbing is built. **All numbers, companies, insights and predictions are fake** — generated deterministically from a seeded PRNG so the data is identical every time you load the app.

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS, shadcn/ui-style primitives (built into the repo, no CLI required)
- Recharts for charts
- lucide-react for icons
- next-themes for dark mode
- No backend, no API calls, no auth, no database

## Run locally

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

If you don't have pnpm: `npm i -g pnpm` then re-run, or use `npm install && npm run dev`.

## Deploy to Vercel

```bash
pnpm i -g vercel
vercel
```

Accept the defaults — it's a stock Next.js app. Subsequent deploys are `vercel --prod`.

## Pages

- **/** — Project overview with both regions side-by-side and the long-form monthly narrative.
- **/kpis** — KPI cards, LTM revenue trend, LTV histogram, AOV vs median, customer concentration, three-definitions-of-churn.
- **/whales** — Top 50 by LTM revenue: sortable table, top-50 share donut, whale health donut, three accounts needing attention this week.
- **/lapsed** — Lapsed tier breakdown, reactivation funnel, email sequence performance, top-50 lapsed by historical value with composite reactivation score.
- **/reorder** — Tabbed reorder feed (Urgent / This week / Next week / Next 30 days), 8-week revenue forecast, cadence-cohort donut.
- **/rfm** — 5×5 R×F heatmap, segments by count, segments by revenue, segment table with definitions and recommended actions.
- **/health** — Health-band donut, 12-week green-band trend, today's amber + red movers with composite signal breakdown.
- **/crosssell** — Top-30 whitespace opportunities with peer-basket-implied annual revenue, most-frequently-missing SKUs, peer-basket lift rules.
- **/segments** — Card grid: every Phase 2 segment with definition, count, LTM revenue, recommended action, owner.
- **/insights** — Reverse-chronological feed of every AI insight across both regions, with region/type filters and a featured monthly narrative at the top.

## Region toggle

UK / US toggle in the top right of every page. Persists to `localStorage` (`whale.region`). Defaults to UK on first visit.

## Theme

System default; toggle in top-right corner.

## Data

All under `lib/mock-data/`:

- `companies.ts` — generates 500 UK + 300 US companies with Pareto-skewed revenue, deterministic from `mulberry32` seeds. The five most-storied named whales per region (e.g. Sheffield Steelworks, Houston Petroleum Services) are forced into specific narrative arcs so the same names appear consistently across the whales / lapsed / health / insights views.
- `skus.ts` — ~80 industrial SKUs (safety signs, floor marking, PPE, spill, access, etc.).
- `segments.ts` — Phase 2 segment definitions (Whales, Lapsed, Slipping, Ideal, Prospects, Ready for Repeat, Hibernating, New, Win-back, Cross-sell) with derived membership.
- `kpis.ts` — region KPIs and 12-month monthly trends. The trend has a slight uptick in churn over the last 3 months — that's deliberate, it gives the CEO a reason to act.
- `insights.ts` — 16 pre-written insight bodies (8 per region) plus two from yesterday so the feed doesn't look empty. Tone is meant to read like a sharp analyst writeup.
- `rng.ts` — seeded PRNG + helpers (`pick`, `gaussian`, `paretoRevenue`).

Editing data: change a seed in `companies.ts` to reshuffle, or hand-edit specific named whales in `name-banks.ts`. Any change rebuilds instantly because everything is regenerated at module load time.

## Notes for review

- **Story consistency** — Sheffield Steelworks (UK) and Detroit Manufacturing Inc (US) are the slipping whales. Birmingham Engineering, Newcastle Marine, Glasgow Industrial, Bristol Highway, Leeds Logistics are the lapsed whales. These names should appear repeatedly across the AI insights, the whales table, the lapsed table, and the health movers table — that's the narrative thread Freddie should follow.
- **AI insights** are pre-written; nothing actually calls Anthropic. They're written to read the way real Claude output reads — concise, specific, action-oriented, naming actual companies.
- The mock-up is polished but not production. No tests, no auth, no database, no real APIs. That's the point — it's a storytelling artifact.

## What to look at first

1. Open <http://localhost:3000> — the home page sets the frame.
2. Read the monthly narrative banner — that's the long-form CEO read.
3. Click into **Whales** — see Sheffield Steelworks at the top of the attention list.
4. Click **Lapsed** — see the named lapsed whales the insight referenced.
5. Click **Health** — see Sheffield in red on the movers table.
6. Click **Insights hub** — read the feed end-to-end, it's only 18 entries.
7. Toggle to **US** at the top-right and repeat.
