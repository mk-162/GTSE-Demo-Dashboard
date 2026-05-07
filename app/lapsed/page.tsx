"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useRegion } from "@/components/region-context";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarSeriesChart } from "@/components/charts/bar-chart";
import { lapsedTier, COMPANIES_UK, COMPANIES_US, insightOf } from "@/lib/mock-data";
import { targetsUrl } from "@/lib/criteria-url";
import { formatCurrency, formatDate } from "@/lib/utils";

function reactivationLikelihood(c: { healthScore: number; lifetimeRevenue: number; daysSinceLastOrder: number; lifetimeOrders: number }): number {
  // Higher health, higher LTM revenue, recent (relatively) lapse, multiple historical orders => higher likelihood.
  let score = c.healthScore * 0.4;
  score += Math.min(c.lifetimeRevenue / 1000, 40); // cap 40
  score += Math.min(c.lifetimeOrders, 20) * 1.2;
  score -= Math.min(c.daysSinceLastOrder / 10, 30);
  return Math.max(2, Math.min(98, Math.round(score)));
}

export default function LapsedPage() {
  const { region } = useRegion();
  const insight = insightOf(region, "lapsed_priorities")!;
  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;

  const slipping = all.filter((c) => lapsedTier(c) === "Slipping" && c.lapseRatio >= 1.0);
  const lapsing = all.filter((c) => lapsedTier(c) === "Lapsing");
  const lapsed = all.filter((c) => lapsedTier(c) === "Lapsed");
  const dormant = all.filter((c) => lapsedTier(c) === "Dormant");

  const tierData = [
    { tier: "Slipping (1.0–1.5×)", count: slipping.length },
    { tier: "Lapsing (1.5–2.5×)", count: lapsing.length },
    { tier: "Lapsed (2.5–4×)", count: lapsed.length },
    { tier: "Dormant (4×+)", count: dormant.length },
  ];

  // Top 50 lapsed by historical (lifetime) revenue
  const topLapsed = [...all.filter((c) => c.lapseRatio >= 1.5)]
    .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
    .slice(0, 50);

  // Reactivation funnel — derive plausible mock numbers from total lapsed pool
  const lapsedPool = lapsing.length + lapsed.length + dormant.length;
  const sent = Math.round(lapsedPool * 0.85);
  const opened = Math.round(sent * 0.40);
  const replied = Math.round(opened * 0.15);
  const reordered = Math.round(replied * 0.30);

  // Email sequence performance (mocked)
  const emailSequence = [
    { step: "Email 1 — Soft", openRate: 38, replyRate: 1.8 },
    { step: "Email 2 — Value", openRate: 32, replyRate: 2.4 },
    { step: "Email 3 — Offer", openRate: 28, replyRate: 4.1 },
    { step: "Email 4 — Personal", openRate: 24, replyRate: 5.2 },
    { step: "Email 5 — Last touch", openRate: 19, replyRate: 3.1 },
  ];

  return (
    <PageShell
      title="Lapsed customers"
      subtitle={`Reactivation priorities for the ${region} customer base. Tier defined by ratio of days-since-last-order to personal cadence.`}
    >
      <InsightBanner
        bodyMarkdown={insight.bodyMarkdown}
        generatedAt={insight.generatedAt}
        dataSnapshotSummary={insight.dataSnapshotSummary}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Lapsed tiers</CardTitle>
            <CardDescription>Counts by lapse-ratio band.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={tierData}
              xKey="tier"
              series={[{ key: "count", label: "Accounts", color: "#dc2626" }]}
              yFormatter={(v) => v.toString()}
              height={240}
              showLegend={false}
              cellColors={["#f59e0b", "#ea580c", "#dc2626", "#7f1d1d"]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reactivation funnel</CardTitle>
            <CardDescription>Last campaign cohort: lapsed pool through to reorder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Lapsed pool", value: lapsedPool, color: "bg-slate-300" },
              { label: "Email sent", value: sent, color: "bg-sky-300" },
              { label: "Email opened", value: opened, color: "bg-sky-500" },
              { label: "Replied", value: replied, color: "bg-emerald-500" },
              { label: "Reordered", value: reordered, color: "bg-emerald-700" },
            ].map((row, i) => {
              const pct = (row.value / lapsedPool) * 100;
              return (
                <div key={i}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value}{i > 0 ? ` (${pct.toFixed(0)}% of pool)` : ""}</span>
                  </div>
                  <div className="h-2.5 w-full rounded bg-muted">
                    <div className={`h-2.5 rounded ${row.color}`} style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email sequence</CardTitle>
            <CardDescription>Open and reply rates by step.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={emailSequence}
              xKey="step"
              series={[
                { key: "openRate", label: "Open %", color: "#0ea5b7" },
                { key: "replyRate", label: "Reply %", color: "#16a34a" },
              ]}
              yFormatter={(v) => `${v}%`}
              height={240}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Top 50 lapsed by historical value</CardTitle>
            <CardDescription>Sorted by lifetime revenue. Reactivation likelihood is a composite score from health, history, and recency of lapse.</CardDescription>
          </div>
          <Button asChild size="sm" className="bg-gtse-orange hover:bg-gtse-orange-dark">
            <Link href={targetsUrl({ region, lapseRatio: { min: 1.5, max: 10 } })}>
              <Download className="h-3.5 w-3.5" /> Open as list / export
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
                <TableHead className="text-right">Last order</TableHead>
                <TableHead className="text-right">Days since</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Buyer intent</TableHead>
                <TableHead className="text-right">Reactivate score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLapsed.map((c) => {
                const tier = lapsedTier(c);
                const tierColor =
                  tier === "Slipping" ? "amber" : tier === "Lapsing" ? "amber" : tier === "Lapsed" ? "red" : "red";
                const score = reactivationLikelihood(c);
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
                    <TableCell className="text-right">{formatDate(c.lastOrderDate)}</TableCell>
                    <TableCell className="text-right">{c.daysSinceLastOrder}d</TableCell>
                    <TableCell><Badge variant={tierColor}>{tier}</Badge></TableCell>
                    <TableCell>
                      {c.buyerIntentActive ? <Badge variant="green">Active</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 rounded bg-muted">
                          <div
                            className="h-1.5 rounded bg-primary"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm font-medium">{score}</span>
                      </div>
                    </TableCell>
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
