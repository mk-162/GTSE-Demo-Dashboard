"use client";

import Link from "next/link";
import {
  ArrowRight, AlertTriangle, Crown, RefreshCw, HeartPulse, Network, Sparkles, Activity,
  Phone, Target, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { HealthBadge, LapseBadge } from "@/components/health-badge";
import {
  COMPANIES_UK, COMPANIES_US, insightOf,
} from "@/lib/mock-data";
import { targetsUrl } from "@/lib/criteria-url";
import { useRegion } from "@/components/region-context";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

const TODAY = new Date("2026-05-07");

function daysVsPredicted(predictedNextOrderDate: string): number {
  return Math.round((new Date(predictedNextOrderDate).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
}

function expectedOrderValue(c: { ltmRevenue: number; personalCadenceDays: number | null }): number {
  const cadence = c.personalCadenceDays ?? 90;
  const orders = Math.max(1, Math.round(365 / cadence));
  return Math.round(c.ltmRevenue / orders);
}

export default function HomePage() {
  const { region } = useRegion();
  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  const monthly = insightOf(region, "monthly_narrative")!;

  // Action queue 1 — overdue reorders, ranked by predicted £
  const overdueReorders = all
    .filter((c) => c.lifetimeOrders >= 3 && daysVsPredicted(c.predictedNextOrderDate) < 0)
    .sort((a, b) => expectedOrderValue(b) - expectedOrderValue(a))
    .slice(0, 5);

  // Action queue 2 — buyer intent active on lapsed/slipping (highest priority for AE call)
  const intentBack = all
    .filter((c) => c.buyerIntentActive && c.lapseRatio >= 1.2)
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 5);

  // Action queue 3 — accounts that turned red today (worst health, ranked by historical revenue)
  const redMovers = all
    .filter((c) => c.healthBand === "red")
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 5);

  // Action queue 4 — lapsed worth reactivating (high LTM, recent enough)
  const lapsedReactivate = all
    .filter((c) => c.lapseRatio >= 1.5 && c.lapseRatio < 4 && c.lifetimeRevenue >= 8000)
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 5);

  // Headline counts
  const totalOverdue = all.filter((c) => c.lifetimeOrders >= 3 && daysVsPredicted(c.predictedNextOrderDate) < 0).length;
  const totalIntent = all.filter((c) => c.buyerIntentActive && c.lapseRatio >= 1.2).length;
  const totalRed = all.filter((c) => c.healthBand === "red").length;
  const totalLapsed = all.filter((c) => c.lapseRatio >= 1.5 && c.lapseRatio < 4 && c.lifetimeRevenue >= 8000).length;

  const todayLong = TODAY.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <PageShell
      title={`Today · ${todayLong}`}
      subtitle={`${region} action queue. Click any account to open it. Click 'Open list' to bulk-export.`}
    >
      <InsightBanner
        bodyMarkdown={monthly.bodyMarkdown}
        generatedAt={monthly.generatedAt}
        dataSnapshotSummary={monthly.dataSnapshotSummary}
      />

      {/* Top 4 quick stats */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <QueueStat
          label="Overdue reorders"
          count={totalOverdue}
          accent="amber"
          icon={RefreshCw}
          listHref={targetsUrl({ region, lapseRatio: { min: 1.0, max: 10 } })}
        />
        <QueueStat
          label="Buyer intent active (lapsed)"
          count={totalIntent}
          accent="orange"
          icon={Activity}
          listHref={targetsUrl({ region, buyerIntentActive: true, lapseRatio: { min: 1.2, max: 10 } })}
        />
        <QueueStat
          label="Red-band accounts"
          count={totalRed}
          accent="red"
          icon={HeartPulse}
          listHref={targetsUrl({ region, healthBands: ["red"] })}
        />
        <QueueStat
          label="High-value lapsed"
          count={totalLapsed}
          accent="amber"
          icon={AlertTriangle}
          listHref={targetsUrl({ region, lapseRatio: { min: 1.5, max: 4 }, lifetimeRevenue: { min: 8000, max: 5_000_000 } })}
        />
      </div>

      {/* Two-column action queues */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActionQueue
          title="Call list — buyer intent on lapsed"
          description="These accounts came back to the website. Talk to them today."
          icon={Phone}
          accent="orange"
          rows={intentBack}
          empty="No buyer-intent signals on lapsed accounts today — all clear."
          renderRow={(c) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <Link href={`/account/${c.id}`} className="font-medium hover:text-gtse-orange">{c.name}</Link>
                <span className="text-xs text-muted-foreground">{c.ownerName}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatCurrency(c.lifetimeRevenue, c.region)} lifetime</span>
                <span>·</span>
                <span>{c.daysSinceLastOrder}d silent</span>
                <span>·</span>
                <LapseBadge ratio={c.lapseRatio} />
                <Badge variant="green">Intent active</Badge>
              </div>
            </>
          )}
          listHref={targetsUrl({ region, buyerIntentActive: true, lapseRatio: { min: 1.2, max: 10 } })}
        />

        <ActionQueue
          title="Reorder this week"
          description="Past their personal cadence — predicted £ shown."
          icon={RefreshCw}
          accent="amber"
          rows={overdueReorders}
          empty="No accounts overdue today."
          renderRow={(c) => {
            const dvp = daysVsPredicted(c.predictedNextOrderDate);
            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/account/${c.id}`} className="font-medium hover:text-gtse-orange">{c.name}</Link>
                  <span className="text-sm font-semibold">{formatCurrency(expectedOrderValue(c), c.region)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="red">{dvp}d overdue</Badge>
                  <span>predicted {formatDate(c.predictedNextOrderDate)}</span>
                  <span>·</span>
                  <span>{c.ownerName}</span>
                </div>
              </>
            );
          }}
          listHref="/reorder"
        />

        <ActionQueue
          title="Reactivate this week"
          description="High lifetime value, gone quiet — call before they age out."
          icon={AlertTriangle}
          accent="amber"
          rows={lapsedReactivate}
          empty="No high-value lapsed accounts in scope."
          renderRow={(c) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <Link href={`/account/${c.id}`} className="font-medium hover:text-gtse-orange">{c.name}</Link>
                <span className="text-sm font-semibold">{formatCurrency(c.lifetimeRevenue, c.region)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{c.daysSinceLastOrder}d since last order</span>
                <LapseBadge ratio={c.lapseRatio} />
                <span>·</span>
                <span>{c.ownerName}</span>
              </div>
            </>
          )}
          listHref={targetsUrl({ region, lapseRatio: { min: 1.5, max: 4 }, lifetimeRevenue: { min: 8000, max: 5_000_000 } })}
        />

        <ActionQueue
          title="Turned red"
          description="Accounts in red health band today — ranked by historical revenue."
          icon={HeartPulse}
          accent="red"
          rows={redMovers}
          empty="No red accounts today."
          renderRow={(c) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <Link href={`/account/${c.id}`} className="font-medium hover:text-gtse-orange">{c.name}</Link>
                <HealthBadge band={c.healthBand} score={c.healthScore} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatCurrency(c.lifetimeRevenue, c.region)} lifetime</span>
                <span>·</span>
                <span>{c.daysSinceLastEngagement}d AE silence</span>
                <span>·</span>
                <span>{c.ownerName}</span>
              </div>
            </>
          )}
          listHref={targetsUrl({ region, healthBands: ["red"] })}
        />
      </div>

      {/* Tools row */}
      <Card>
        <CardHeader>
          <CardTitle>Other reports</CardTitle>
          <CardDescription>Custom slices and analytical views.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile href="/targets" title="Target builder" desc="Custom slice → CSV export" icon={Target} accent />
            <Tile href="/whales" title="Whales" desc="Top 50 accounts" icon={Crown} />
            <Tile href="/lapsed" title="Lapsed" desc="Reactivation priorities" icon={AlertTriangle} />
            <Tile href="/reorder" title="Reorder feed" desc="Predicted reorders by week" icon={RefreshCw} />
            <Tile href="/health" title="Health score" desc="Today's amber & red movers" icon={HeartPulse} />
            <Tile href="/crosssell" title="Cross-sell" desc="Whitespace opportunities" icon={Network} />
            <Tile href="/segments" title="Segments" desc="Phase-2 segment definitions" icon={Sparkles} />
            <Tile href="/insights" title="Insights hub" desc="All AI insights" icon={Sparkles} />
            <Tile href="/kpis" title="KPIs" desc="LTV, AOV, churn, concentration" icon={BarChart3} />
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function QueueStat({
  label, count, accent, icon: Icon, listHref,
}: {
  label: string;
  count: number;
  accent: "orange" | "amber" | "red";
  icon: typeof RefreshCw;
  listHref: string;
}) {
  const accentClass = accent === "red" ? "text-red-600" : accent === "orange" ? "text-gtse-orange" : "text-amber-600";
  return (
    <Link href={listHref} className="gtse-tile rounded-sm border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="gtse-eyebrow text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${accentClass}`} />
      </div>
      <div className={`mt-1 text-3xl font-semibold ${accentClass}`}>{formatNumber(count)}</div>
      <div className="mt-1 text-xs text-muted-foreground">View list →</div>
    </Link>
  );
}

function ActionQueue<T extends { id: string }>({
  title, description, icon: Icon, accent, rows, empty, renderRow, listHref,
}: {
  title: string;
  description: string;
  icon: typeof Phone;
  accent: "orange" | "amber" | "red";
  rows: T[];
  empty: string;
  renderRow: (c: T) => React.ReactNode;
  listHref: string;
}) {
  const accentBg = accent === "red" ? "bg-red-100 text-red-700" : accent === "orange" ? "bg-gtse-orange/10 text-gtse-orange" : "bg-amber-100 text-amber-700";
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-sm ${accentBg}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs text-gtse-orange">
            <Link href={listHref}>Open list <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{empty}</div>
        ) : rows.map((c) => (
          <div key={c.id} className="rounded-sm border bg-background p-3 transition-colors hover:border-gtse-orange/60">
            {renderRow(c)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Tile({
  href, title, desc, icon: Icon, accent,
}: { href: string; title: string; desc: string; icon: typeof Target; accent?: boolean }) {
  return (
    <Link
      href={href}
      className="gtse-tile group flex items-center gap-3 rounded-sm border bg-card p-4"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-white transition-colors ${accent ? "bg-gtse-orange group-hover:bg-gtse-orange-dark" : "bg-gtse-teal group-hover:bg-gtse-orange"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{title}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gtse-orange" />
        </div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}
