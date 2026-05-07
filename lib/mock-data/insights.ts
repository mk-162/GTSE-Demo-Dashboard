export type InsightType =
  | "kpi_summary"
  | "whale_attention"
  | "lapsed_priorities"
  | "reorder_urgency"
  | "cross_segment_surprise"
  | "monthly_narrative"
  | "health_movers"
  | "cross_sell_opportunities";

export type Insight = {
  id: string;
  insightType: InsightType;
  region: "UK" | "US";
  generatedAt: string;
  bodyMarkdown: string;
  dataSnapshotSummary: string;
};

const TODAY_03_14 = "2026-05-07T03:14:00Z";
const TODAY_03_12 = "2026-05-07T03:12:00Z";
const TODAY_03_18 = "2026-05-07T03:18:00Z";
const TODAY_03_22 = "2026-05-07T03:22:00Z";
const YESTERDAY_03_14 = "2026-05-06T03:14:00Z";

export const INSIGHTS: Insight[] = [
  // === UK ===
  {
    id: "uk_kpi_summary",
    insightType: "kpi_summary",
    region: "UK",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**UK customer base remains revenue-healthy but operationally fragile.** LTM revenue is up 6% year-on-year, driven almost entirely by the top 50 accounts (now ~70% of total). The cadence-based churn rate has crept from 18.9% to 22.4% over the last quarter — that's roughly 17 additional accounts that have moved past 2× their reorder rhythm without us noticing. Median order value is steady at £680 but AOV (£2,240) is 3.3× higher, confirming the whale skew. **Recommended:** treat the cadence churn rate as the operational metric on weekly reviews — it's earlier than the 12-month rolling number and more honest than the cohort one.",
    dataSnapshotSummary: "Based on 500 UK accounts, 6,012 orders, as of 7 May 2026.",
  },
  {
    id: "uk_whale_attention",
    insightType: "whale_attention",
    region: "UK",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**Your top 5 whales lost 18% revenue collectively this quarter** — driven primarily by **Sheffield Steelworks** dropping ~60% in the last 90 days. Sheffield hasn't been called in 21 days. Worth a same-day touch from their AE (Sarah Whitcombe). The other four whales remain healthy but **Cardiff Construction Group** is showing early signs of basket-size shrink (-22% L90d) — keep an eye on next month's reorder. Two named whales (**Birmingham Engineering**, **Manchester Manufacturing**) remain in green health and on cadence; no action needed.",
    dataSnapshotSummary: "Based on top 50 UK whale accounts as of 7 May 2026.",
  },
  {
    id: "uk_lapsed_priorities",
    insightType: "lapsed_priorities",
    region: "UK",
    generatedAt: TODAY_03_12,
    bodyMarkdown:
      "**5 lapsed accounts worth reactivating this week**, ranked by addressable value: **Birmingham Engineering** (£42k LTM, 6 months silent), **Newcastle Marine** (£31k, 8 months), **Glasgow Industrial** (£28k, 5 months), **Bristol Highway** (£26k, 7 months), **Leeds Logistics** (£22k, 9 months). Each previously ordered floor-marking SKUs — lead with the new bulk pricing announced in March. Birmingham and Glasgow both opened the March campaign email but didn't click; warm enough for a phone follow-up rather than another email.",
    dataSnapshotSummary: "Based on 109 UK accounts past 2× cadence, as of 7 May 2026.",
  },
  {
    id: "uk_reorder_urgency",
    insightType: "reorder_urgency",
    region: "UK",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**12 accounts overdue on their reorder cadence this week.** Focus on the 3 in 'urgent': **Manchester Manufacturing** (8 days overdue on monthly safety-sign reorder), **Cardiff Construction Group** (4 days overdue on quarterly PPE reorder), and **Sheffield Steelworks** (drifting toward urgent — 18 days past their typical quarterly window). Combined predicted order value ~£18,400 if recovered this week. A further 27 accounts come due in the next 14 days — automate reminders for these and reserve AE time for the urgent three.",
    dataSnapshotSummary: "Based on UK reorder predictions across 412 active accounts, 7 May 2026.",
  },
  {
    id: "uk_cross_segment_surprise",
    insightType: "cross_segment_surprise",
    region: "UK",
    generatedAt: TODAY_03_18,
    bodyMarkdown:
      "**Surprise finding from RFM segmentation:** 14% of accounts in the 'Promising' bucket (recent, low frequency) come from the same three industries — **Highway Maintenance, Logistics, and Construction**. Average AOV is £1,820, which is *above* the UK average. This is a viable secondary growth segment if the AE team prioritises it: 30+ accounts that bought once or twice and never came back, but are spending well per visit. Treat as a high-yield winback list, not just generic onboarding.",
    dataSnapshotSummary: "Based on RFM segmentation of 500 UK accounts, 7 May 2026.",
  },
  {
    id: "uk_monthly_narrative",
    insightType: "monthly_narrative",
    region: "UK",
    generatedAt: TODAY_03_22,
    bodyMarkdown:
      "**April UK customer narrative.** Top-line revenue ticked up 4.1% vs March (~£312k), but the composition is shifting in ways that warrant attention. Three named whales — **Sheffield Steelworks**, **Cardiff Construction**, **Newcastle Marine** — collectively account for £41k of the £52k month-on-month softness in the top tier. Sheffield's drop is the most acute (60% off in 90 days), and is the single biggest revenue risk in the UK book right now. Offsetting this, the mid-market band (LTM £8k–£40k accounts) grew 7.2% month-on-month, with notable uplift in **Highway Maintenance** and **Pharmaceutical Manufacturing** segments — a signal that the new floor-marking range is landing. **Buyer-intent signals are unusually elevated this week: 8 lapsed accounts have returned to the website**, including former whale **Newcastle Marine** (first visit in 4 months). Two of those eight have already been emailed but not called — recommend AE prioritises Newcastle and **Glasgow Industrial Solutions** for same-day phone outreach. **Bottom line:** the book is growing, but the whale tier is leaking. One AE day this week on Sheffield + Newcastle + Cardiff would likely save more revenue than any new-business effort.",
    dataSnapshotSummary: "Based on 500 UK accounts, 6,012 orders, 30-day window ending 7 May 2026.",
  },
  {
    id: "uk_health_movers",
    insightType: "health_movers",
    region: "UK",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**11 accounts crossed into amber today** and **3 into red**. Of note: **Sheffield Steelworks** moved amber → red overnight after another missed reorder window. Composite signal: velocity drop ✓, basket shrink ✓, engagement silence ✓, contact churn ✗ (still 4 active contacts). Translation: they're still talking to us, but they've stopped buying. That's recoverable if approached this week, but the window narrows fast. **Bristol Highway Maintenance** also moved amber today — first time in 14 months — and warrants a check-in call.",
    dataSnapshotSummary: "Based on health-score recomputation, 7 May 2026.",
  },
  {
    id: "uk_cross_sell_opportunities",
    insightType: "cross_sell_opportunities",
    region: "UK",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**Top whitespace opportunity in the UK book: Spill Control SKUs across Manufacturing accounts** that buy PPE consistently but have never ordered spill kits. 23 accounts fit this profile, with combined estimated whitespace revenue of £41k/year if attached. Largest single account: **Manchester Manufacturing Group** (peers in Manufacturing buy spill kits at 4.2× the rate; Manchester has bought zero). Recommend AE leads with the Oil Spill Kit 240L on the next quarterly review. Second-largest opportunity: **Edinburgh Utilities Plc** — should be buying LOTO kits given site profile but currently only buys PPE.",
    dataSnapshotSummary: "Based on peer-basket analysis across 500 UK accounts, 7 May 2026.",
  },

  // === US ===
  {
    id: "us_kpi_summary",
    insightType: "kpi_summary",
    region: "US",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**US book is smaller but tighter.** 300 active accounts, top 50 representing ~68% of LTM revenue. Cadence churn at 19.1% is roughly stable quarter-on-quarter. **AOV is meaningfully higher than UK** ($3,180 vs £2,240) — driven by larger industrial SKU mix in Texas and Michigan accounts. Repeat rate is 78%, slightly ahead of the UK. **The number to watch:** customer concentration in the top 10 is creeping up (now 38.4% of revenue, vs 34.2% a year ago). That's a single-customer-loss risk worth flagging.",
    dataSnapshotSummary: "Based on 300 US accounts, 3,512 orders, as of 7 May 2026.",
  },
  {
    id: "us_whale_attention",
    insightType: "whale_attention",
    region: "US",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**Top 5 US whales held flat this quarter (+1.2%)** — broadly the picture you want. Two exceptions: **Detroit Manufacturing Inc** and **Phoenix Highway Contractors** are both showing early lapse signals (1.6× and 1.7× cadence). Detroit's owner (Brett Kowalski) hasn't logged a touchpoint in 19 days. **Houston Petroleum Services** continues to be the standout account in the US book — health green, basket growing 14% L90d, no action needed. Worth a thank-you check-in nonetheless given the dependency.",
    dataSnapshotSummary: "Based on top 50 US whale accounts as of 7 May 2026.",
  },
  {
    id: "us_lapsed_priorities",
    insightType: "lapsed_priorities",
    region: "US",
    generatedAt: TODAY_03_12,
    bodyMarkdown:
      "**4 high-value US accounts to reactivate this week**: **Boston Marine Engineering** ($38k LTM, 7 months), **Miami Facilities LLC** ($26k, 6 months), **Atlanta Industrial Supply** ($21k, 9 months), **Portland Construction** ($19k, 5 months). Three of the four previously bought floor-marking and PPE — strong lead for the spring promo bundle. Atlanta has been silent longest but had highest ever AOV ($4,200) — worth an AE call rather than another email touch.",
    dataSnapshotSummary: "Based on 61 US accounts past 2× cadence, as of 7 May 2026.",
  },
  {
    id: "us_reorder_urgency",
    insightType: "reorder_urgency",
    region: "US",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**8 US accounts overdue on reorder cadence.** Three urgent: **Detroit Manufacturing** (10 days overdue on monthly PPE), **Chicago Logistics Group** (6 days overdue on quarterly safety-signs reorder), **Seattle Aerospace Components** (4 days overdue on a small monthly resupply). Combined predicted order value ~$11,200. A further 14 accounts come due in the next 14 days — most are mid-tier and best handled by automated email reminders.",
    dataSnapshotSummary: "Based on US reorder predictions across 248 active accounts, 7 May 2026.",
  },
  {
    id: "us_cross_segment_surprise",
    insightType: "cross_segment_surprise",
    region: "US",
    generatedAt: TODAY_03_18,
    bodyMarkdown:
      "**A surprising US pattern in the RFM heatmap:** the 'Cannot Lose' segment is unusually large — 8.3% of accounts vs 4.1% UK. These are high-frequency, high-monetary accounts that have gone quiet. Leading candidates: **Atlanta Industrial Supply, Boston Marine, Miami Facilities**. Each was a top-30 account historically. Don't fold them into a generic winback — they need named-account treatment from senior AE within the next 30 days.",
    dataSnapshotSummary: "Based on RFM segmentation of 300 US accounts, 7 May 2026.",
  },
  {
    id: "us_monthly_narrative",
    insightType: "monthly_narrative",
    region: "US",
    generatedAt: TODAY_03_22,
    bodyMarkdown:
      "**April US customer narrative.** Revenue tracked broadly flat ($240k, +1.8% vs March), but with healthier internal mix than the UK. **Houston Petroleum Services** continues to be the anchor account — 14% L90d basket growth and engaged across 6 contacts. The story risks are **Detroit Manufacturing Inc** and **Phoenix Highway Contractors**: both have slipped past their natural cadence and both have AE silence over 14 days. Combined exposure is ~$58k LTM. The mid-market is doing well: 9 new accounts in the last 30 days, with **Aerospace** and **Logistics** sectors leading. Buyer-intent activity is moderate (12% of US accounts active on the website L7d), with **Boston Marine Engineering** worth a same-day call — first site visit in 4 months.",
    dataSnapshotSummary: "Based on 300 US accounts, 3,512 orders, 30-day window ending 7 May 2026.",
  },
  {
    id: "us_health_movers",
    insightType: "health_movers",
    region: "US",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**6 US accounts crossed into amber today**, **2 into red**. **Detroit Manufacturing Inc** is the highlight: amber → red after a missed reorder and 19 days of AE silence. Composite breakdown: velocity drop ✓, basket shrink ✓, engagement silence ✓, contact churn ✗. Single phone call can likely arrest this — they remain a 6-contact account. **Atlanta Industrial Supply** turned amber for the first time this year; not urgent but worth the AE noting.",
    dataSnapshotSummary: "Based on health-score recomputation, 7 May 2026.",
  },
  {
    id: "us_cross_sell_opportunities",
    insightType: "cross_sell_opportunities",
    region: "US",
    generatedAt: TODAY_03_14,
    bodyMarkdown:
      "**Highest-yield US whitespace pattern: AED Defibrillators across Logistics & Warehousing accounts** that already buy first-aid kits but no defib. 11 accounts fit, combined estimated whitespace ~$28k. Largest single opportunity: **Chicago Logistics Group** — peer-basket lift suggests strong attach rate. Second pattern: **Aerospace Components** accounts under-buy spill control (5 candidates, ~$19k whitespace) — **Seattle Aerospace** is the standout candidate for first call.",
    dataSnapshotSummary: "Based on peer-basket analysis across 300 US accounts, 7 May 2026.",
  },
];

// Add a few from yesterday so the insights hub feed feels alive
INSIGHTS.push(
  {
    id: "uk_health_movers_yest",
    insightType: "health_movers",
    region: "UK",
    generatedAt: YESTERDAY_03_14,
    bodyMarkdown:
      "**8 accounts crossed into amber overnight.** Notable: **Sheffield Steelworks** continues to deteriorate (now in mid-amber, score 51). No AE engagement logged in the last 24 hours.",
    dataSnapshotSummary: "Based on health-score recomputation, 6 May 2026.",
  },
  {
    id: "us_health_movers_yest",
    insightType: "health_movers",
    region: "US",
    generatedAt: YESTERDAY_03_14,
    bodyMarkdown:
      "**4 US accounts crossed into amber overnight.** **Detroit Manufacturing** moved from green-amber boundary (68) to mid-amber (54) — sharp single-day drop driven by a missed reorder rolling into the metric.",
    dataSnapshotSummary: "Based on health-score recomputation, 6 May 2026.",
  },
);

export function insightsByRegion(region: "UK" | "US"): Insight[] {
  return INSIGHTS.filter((i) => i.region === region);
}

export function insightOf(region: "UK" | "US", type: InsightType): Insight | undefined {
  return INSIGHTS.find((i) => i.region === region && i.insightType === type && !i.id.endsWith("_yest"));
}
