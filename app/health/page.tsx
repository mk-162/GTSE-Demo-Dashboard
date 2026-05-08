"use client";

import Link from "next/link";
import { Check, Download } from "lucide-react";
import { useRegion } from "@/components/region-context";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/charts/donut-chart";
import { LineSeriesChart } from "@/components/charts/line-chart";
import { HealthBadge } from "@/components/health-badge";
import { COMPANIES_UK, COMPANIES_US, insightOf, type Company } from "@/lib/mock-data";
import { targetsUrl } from "@/lib/criteria-url";
import { formatCurrency, formatNumber } from "@/lib/utils";

function compositeSignals(c: Company) {
  const velocityDrop = c.l90dRevenue < c.prior90dRevenue * 0.7;
  const basketShrink = c.l90dRevenue > 0 && c.l90dRevenue < c.prior90dRevenue * 0.85 && !velocityDrop;
  const engagementSilence = c.daysSinceLastEngagement >= 21;
  const contactChurn = c.activeContacts <= 1;
  return { velocityDrop, basketShrink, engagementSilence, contactChurn };
}

function SignalCheck({ on }: { on: boolean }) {
  if (!on) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <Check className="h-3 w-3" />
    </span>
  );
}

export default function HealthPage() {
  const { region } = useRegion();
  const insight = insightOf(region, "health_movers")!;
  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;

  const green = all.filter((c) => c.healthBand === "green");
  const amber = all.filter((c) => c.healthBand === "amber");
  const red = all.filter((c) => c.healthBand === "red");

  const bands = [
    { name: "Green", value: green.length, color: "#16a34a" },
    { name: "Amber", value: amber.length, color: "#f59e0b" },
    { name: "Red", value: red.length, color: "#dc2626" },
  ];

  // Health trend — % in green over last 12 weeks. Mocked downward drift.
  const baseGreenPct = (green.length / all.length) * 100;
  const greenTrend = Array.from({ length: 12 }, (_, i) => {
    // start higher, drift down to current
    const startPct = baseGreenPct + 6;
    const pct = startPct + ((baseGreenPct - startPct) * i) / 11 + Math.sin(i / 2) * 0.6;
    return { week: `Wk ${i - 11}`, greenPct: Math.round(pct * 10) / 10 };
  });
  // Last entry should be the current pct
  greenTrend[greenTrend.length - 1] = { week: "This week", greenPct: Math.round(baseGreenPct * 10) / 10 };

  // "Turned amber today" = pretend the worst-50 ambers turned today
  const turnedAmber = [...amber]
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 12);

  // "Turned red today" = top reds by historical revenue
  const turnedRed = [...red]
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 8);

  return (
    <PageShell
      title="Health score"
      subtitle={`Composite per-account health: cadence × engagement × contact churn. ${region} customer base.`}
    >
      <InsightBanner
        bodyMarkdown={insight.bodyMarkdown}
        generatedAt={insight.generatedAt}
        dataSnapshotSummary={insight.dataSnapshotSummary}
        insightType={insight.insightType}
        region={insight.region}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Health-band distribution</CardTitle>
            <CardDescription>Where today's accounts sit.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={bands}
              tooltipFormatter={(v) => `${v} accounts`}
              centerLabel={{ value: formatNumber(all.length), sub: "accounts" }}
              height={240}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>% of accounts in green band</CardTitle>
            <CardDescription>Last 12 weeks. Slight drift down — recent reorder cadence drift is showing.</CardDescription>
          </CardHeader>
          <CardContent>
            <LineSeriesChart
              data={greenTrend}
              xKey="week"
              series={[{ key: "greenPct", label: "% in green", color: "#16a34a" }]}
              yFormatter={(v) => `${v}%`}
              height={240}
              showLegend={false}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Companies that turned amber today</CardTitle>
            <CardDescription>Composite signal breakdown — checkmarks show which factors flagged.</CardDescription>
          </div>
          <Button asChild size="sm" className="bg-gtse-orange hover:bg-gtse-orange-dark">
            <Link href={targetsUrl({ region, healthBands: ["amber"] })}>
              <Download className="h-3.5 w-3.5" /> All amber as list
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">LTM</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="text-center">Velocity drop</TableHead>
                <TableHead className="text-center">Basket shrink</TableHead>
                <TableHead className="text-center">Engagement silence</TableHead>
                <TableHead className="text-center">Contact churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnedAmber.map((c) => {
                const sig = compositeSignals(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/account/${c.id}`} className="block hover:text-gtse-orange">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.industry}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.ownerName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.ltmRevenue, region)}</TableCell>
                    <TableCell><HealthBadge band={c.healthBand} score={c.healthScore} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.velocityDrop} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.basketShrink} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.engagementSilence} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.contactChurn} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Companies that turned red today</CardTitle>
            <CardDescription>Ranked by historical revenue — fix the leakiest first.</CardDescription>
          </div>
          <Button asChild size="sm" className="bg-gtse-orange hover:bg-gtse-orange-dark">
            <Link href={targetsUrl({ region, healthBands: ["red"] })}>
              <Download className="h-3.5 w-3.5" /> All red as list
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Lifetime revenue</TableHead>
                <TableHead className="text-right">LTM</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="text-center">Velocity drop</TableHead>
                <TableHead className="text-center">Basket shrink</TableHead>
                <TableHead className="text-center">Engagement silence</TableHead>
                <TableHead className="text-center">Contact churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnedRed.map((c) => {
                const sig = compositeSignals(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/account/${c.id}`} className="block hover:text-gtse-orange">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.industry}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.ownerName}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.lifetimeRevenue, region)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.ltmRevenue, region)}</TableCell>
                    <TableCell><HealthBadge band={c.healthBand} score={c.healthScore} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.velocityDrop} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.basketShrink} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.engagementSilence} /></TableCell>
                    <TableCell className="text-center"><SignalCheck on={sig.contactChurn} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
