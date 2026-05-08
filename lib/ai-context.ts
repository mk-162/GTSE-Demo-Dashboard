// Build a compact data-context string for the AI to ground its answers in.
// This is what makes "Ask Whale anything" cheap and accurate: instead of
// shoving raw HubSpot records into Claude's context, we send a tiny pre-aggregated
// summary that's enough for it to reason about the customer base.

import { COMPANIES_UK, COMPANIES_US, type Company } from "./mock-data/companies";
import { kpisByRegion } from "./mock-data/kpis";
import { segmentsByRegion } from "./mock-data/segments";

const TODAY = new Date("2026-05-08");

function fmt(n: number, currency: "£" | "$"): string {
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${currency}${(n / 1000).toFixed(0)}k`;
  return `${currency}${Math.round(n).toLocaleString()}`;
}

function daysBetweenIso(a: string, b: Date): number {
  return Math.round((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function summariseCompany(c: Company, currency: "£" | "$"): string {
  const last = daysBetweenIso(c.lastOrderDate, TODAY);
  return `- [id=${c.id}] ${c.name} (${c.industry}, ${c.region_subdiv}) | LTM ${fmt(c.ltmRevenue, currency)} | lifetime ${fmt(c.lifetimeRevenue, currency)} | last order ${last}d ago | cadence ${c.personalCadenceDays ?? "?"}d | lapse ${c.lapseRatio.toFixed(2)}× | health ${c.healthBand} (${c.healthScore}) | RFM ${c.rfmSegment} | owner ${c.ownerName}${c.buyerIntentActive ? " | BUYER INTENT ACTIVE" : ""}${c.whaleFlag ? " | whale" : ""}`;
}

export function buildDataContext(region: "UK" | "US"): string {
  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  const currency: "£" | "$" = region === "UK" ? "£" : "$";
  const k = kpisByRegion(region);
  const segs = segmentsByRegion(region);

  // Today's queues
  const overdueReorders = all.filter((c) => {
    if (c.lifetimeOrders < 3) return false;
    const dvp = Math.round((new Date(c.predictedNextOrderDate).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
    return dvp < 0;
  }).length;
  const intentBack = all.filter((c) => c.buyerIntentActive && c.lapseRatio >= 1.2).length;
  const turnedRed = all.filter((c) => c.healthBand === "red").length;
  const lapsedHighValue = all.filter((c) => c.lapseRatio >= 1.5 && c.lapseRatio < 4 && c.lifetimeRevenue >= 8000).length;

  // Top 15 whales (by LTM revenue) with signals
  const top15Whales = [...all]
    .sort((a, b) => b.ltmRevenue - a.ltmRevenue)
    .slice(0, 15);

  // Top 10 lapsed by historical value (currently silent)
  const top10Lapsed = [...all]
    .filter((c) => c.lapseRatio >= 1.5)
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 10);

  // Active intent + lapsed (call list)
  const callList = [...all]
    .filter((c) => c.buyerIntentActive && c.lapseRatio >= 1.2)
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 8);

  const segLines = segs.map((s) =>
    `- ${s.segment}: ${s.count} accounts, ${fmt(s.totalRevenueLtm, currency)} LTM`,
  );

  return `# Project Whale data context — ${region} customer base
As of: ${TODAY.toISOString().slice(0, 10)}

## KPIs
- Total customers: ${k.totalCustomers.toLocaleString()}
- Active LTM: ${k.activeCustomersLtm.toLocaleString()}
- LTM revenue total: ${fmt(all.reduce((s, c) => s + c.ltmRevenue, 0), currency)}
- AOV: ${fmt(k.aov, currency)} | Median order: ${fmt(k.medianOrderValue, currency)}
- LTV (median): ${fmt(k.ltvDistribution.p50, currency)} | p90: ${fmt(k.ltvDistribution.p90, currency)}
- Customer concentration: top 10 = ${k.customerConcentrationTop10}%, top 50 = ${k.customerConcentrationTop50}%
- Repeat rate: ${k.repeatRate}%
- Churn rates: cadence ${k.churnRateCadence}%, rolling ${k.churnRateRolling}%, cohort ${k.churnRateCohort}%

## Today's action queues
- ${overdueReorders} accounts overdue on reorder cadence
- ${intentBack} lapsed accounts with buyer intent active L7d (call list)
- ${turnedRed} accounts in red health band today
- ${lapsedHighValue} high-value lapsed accounts worth reactivating

## Segments
${segLines.join("\n")}

## Top 15 whales (highest LTM revenue)
${top15Whales.map((c) => summariseCompany(c, currency)).join("\n")}

## Top 10 lapsed by historical value
${top10Lapsed.map((c) => summariseCompany(c, currency)).join("\n")}

## Buyer-intent call list (lapsed but back on website)
${callList.length > 0 ? callList.map((c) => summariseCompany(c, currency)).join("\n") : "(none today)"}

## Data shape notes
- Customer database: ${all.length.toLocaleString()} ${region} accounts plus ${region === "UK" ? COMPANIES_US.length.toLocaleString() + " US" : COMPANIES_UK.length.toLocaleString() + " UK"} accounts available.
- 12-month monthly revenue trend (most recent month last): ${k.monthlyTrend.slice(-6).map((m) => `${m.month}: ${fmt(m.revenue, currency)}`).join("; ")}
- Health bands: ≥70 green, 40–69 amber, <40 red
- Lapse ratio: days since last order ÷ personal reorder cadence. >1.5 = lapsing, >2.0 = lapsed.

## Helpful URLs
- /targets — custom slice with sliders + multi-select filters, exports CSV
- /targets?template=former-whales — accounts that were whales but aren't now
- /targets?template=intent-back — lapsed accounts with active buyer intent
- /targets?template=high-value-amber-red — high-value at-risk accounts
- /account/<id> — full per-account drill-in (insights, signals, order history)
- /reorder, /lapsed, /whales, /health, /crosssell — themed reports
- /segments, /rfm — segmentation views
- /insights — pre-generated AI insight feed
`;
}

export function buildInsightPrompt(
  insightType: string,
  region: "UK" | "US",
): { system: string; user: string } | null {
  const ctx = buildDataContext(region);
  const currency = region === "UK" ? "pounds" : "dollars";

  const promptByType: Record<string, { task: string; tone: string }> = {
    kpi_summary: {
      task: "Write a 3-4 sentence summary of the most important KPI movements: biggest mover, most surprising number, one risk, one opportunity. Be specific — use actual numbers from the data context.",
      tone: "Concise sharp analyst writeup — like a Bloomberg morning note. No generic phrasing.",
    },
    whale_attention: {
      task: "Identify the 3 whale accounts most warranting attention this week, with a one-line reason and recommended action for each. Reference real account names from the data context. Use the lapse ratio, health band, and L90d/prior90d revenue change to justify your picks.",
      tone: "Direct, action-oriented, tone of a sales manager briefing the AE team. Name names.",
    },
    lapsed_priorities: {
      task: "List the 5 lapsed accounts worth reactivating first, ranked by addressable value. For each: name, lifetime revenue, months silent, and what to lead with (which SKU category or angle).",
      tone: "Like a campaign brief written by an analyst. Specific names and numbers.",
    },
    reorder_urgency: {
      task: "Group the overdue reorder accounts into 3 urgent ones (call today), then 'this week' (automate reminders), and a single number for 'next 14 days'. Combined predicted recovery value matters.",
      tone: "Operational — like a daily AE call list.",
    },
    cross_segment_surprise: {
      task: "Find one non-obvious pattern in the RFM segmentation. Maybe a segment that's larger or smaller than expected, an industry concentration, or an unusual cell in the heatmap.",
      tone: "Curious analyst — \"here's something I noticed that's worth investigating.\"",
    },
    monthly_narrative: {
      task: "Write a 6-10 sentence narrative summarising this month's standout movements. Cover top-line revenue trend, the whale tier, lapsed/winback signals, and one specific recommendation. Reference 3-5 named accounts.",
      tone: "Long-form CEO read. Like a sharp McKinsey analyst — direct, specific, action-oriented.",
    },
    health_movers: {
      task: "Highlight today's most concerning health-band movers: which accounts moved into amber or red, what the composite signals say, and what to do.",
      tone: "Customer-success briefing — short, named, actionable.",
    },
    cross_sell_opportunities: {
      task: "Identify the highest-yield whitespace opportunity: a SKU category that peers buy but a specific named account or set of accounts under-buys. Include estimated annual whitespace revenue.",
      tone: "Sales-leader briefing — \"here's where the easy growth is.\"",
    },
  };

  const p = promptByType[insightType];
  if (!p) return null;

  const system = `You are a senior B2B sales analyst writing daily insights for GTSE Hub, a UK-headquartered B2B distributor of safety signs and industrial supplies. You're writing for the CEO and the sales/marketing team.

Tone: ${p.tone}

Format your response as plain markdown with **bold** company names. Do NOT use code blocks. Do NOT use bullet headers like "Key Findings" or "Summary". Just write the prose directly. Reference real account names from the data context — they will auto-linkify in the UI. Always quote currency in ${currency}.

Length: keep responses tight. KPI summaries 3-4 sentences. Lists 5-8 items max. Monthly narrative 6-10 sentences max.`;

  const user = `Here is today's data:

${ctx}

---

${p.task}`;

  return { system, user };
}

export const CHAT_SYSTEM_PROMPT = `You are an AI analyst for GTSE Hub, a UK-headquartered B2B distributor of safety signs and industrial supplies. You're embedded in the Project Whale customer-intelligence dashboard. Your users are the CEO, sales managers, and account executives.

You have access to a pre-aggregated data context for the user's currently selected region. Use it to answer questions about the customer base. Always be specific — reference real account names, real numbers, real recommendations.

When the user asks for a list of accounts that match some criteria, suggest opening the Target builder with appropriate filters and provide the URL. URL format examples:
- /targets?template=former-whales
- /targets?template=intent-back
- /targets?health=red — accounts in red health
- /targets?whale=true&health=amber,red — whales at risk
- /targets?lapseRatioMin=1.5&lapseRatioMax=10 — lapsed accounts
- /targets?industry=Manufacturing,Construction&lapseRatioMin=1.5&lapseRatioMax=10

For specific account links, use the ID from the data context: /account/{id}
The IDs look like co_uk_0042 or co_us_0007 — they are listed in the data context as [id=co_xx_NNNN].
NEVER fabricate an account ID or guess a URL slug from a company name.
If a user asks about a company NOT in the listed data, say you don't have that account in the current snapshot rather than inventing a URL.

Style:
- Write like a sharp analyst in a chat with a sales manager. No fluff. No "I'd be happy to help."
- Use **bold** for company names — they auto-linkify in the UI.
- Format URLs as markdown links: [open this list](/targets?...)
- Concise. 2-4 sentences for simple questions. Lists for "give me a list of..." questions.
- If the user asks about something the data context doesn't cover, say so plainly and suggest what would answer the question.

Do NOT make up companies, numbers, or trends. If the data isn't in the context, say "the dashboard doesn't surface that — happy to suggest what we'd need to add."`;
