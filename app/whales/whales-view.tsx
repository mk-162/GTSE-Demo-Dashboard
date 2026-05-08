"use client";

import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DonutChart } from "@/components/charts/donut-chart";
import { HealthBadge, LapseBadge } from "@/components/health-badge";
import type { Company, Insight, Region } from "@/lib/data/contracts";
import { targetsUrl } from "@/lib/criteria-url";
import { formatCurrency, formatPct, formatDate } from "@/lib/utils";

type SortKey = "name" | "owner" | "ltmRevenue" | "concentrationPctL90d" | "lastOrderDate" | "daysSinceLastOrder" | "personalCadenceDays" | "lapseRatio" | "healthScore";

const HEAD: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Company" },
  { key: "owner", label: "Owner" },
  { key: "ltmRevenue", label: "LTM revenue", align: "right" },
  { key: "concentrationPctL90d", label: "% L90d", align: "right" },
  { key: "lastOrderDate", label: "Last order", align: "right" },
  { key: "daysSinceLastOrder", label: "Days since", align: "right" },
  { key: "personalCadenceDays", label: "Cadence", align: "right" },
  { key: "lapseRatio", label: "Lapse" },
  { key: "healthScore", label: "Health" },
];

type Props = {
  region: Region;
  top50: Company[];
  insight?: Insight;
  regionTotalLtm: number;
  top10Sum: number;
  t11_20Sum: number;
  t21_50Sum: number;
  nameToIdMap: Record<string, string>;
};

export function WhalesView({
  region,
  top50,
  insight,
  regionTotalLtm,
  top10Sum,
  t11_20Sum,
  t21_50Sum,
  nameToIdMap,
}: Props) {
  const totalLtm = regionTotalLtm || 1;
  const restLtm = Math.max(0, regionTotalLtm - top10Sum - t11_20Sum - t21_50Sum);

  const [sortKey, setSortKey] = React.useState<SortKey>("ltmRevenue");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const sorted = React.useMemo(() => {
    const copy = [...top50];
    copy.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "name") { va = a.name; vb = b.name; }
      else if (sortKey === "owner") { va = a.ownerName; vb = b.ownerName; }
      else if (sortKey === "lastOrderDate") { va = a.lastOrderDate; vb = b.lastOrderDate; }
      else if (sortKey === "personalCadenceDays") { va = a.personalCadenceDays ?? 0; vb = b.personalCadenceDays ?? 0; }
      else { va = (a[sortKey] as number) ?? 0; vb = (b[sortKey] as number) ?? 0; }
      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [top50, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "owner" ? "asc" : "desc"); }
  }

  const top50ShareData = [
    { name: "Top 10", value: top10Sum, color: "#075985" },
    { name: "11–20", value: t11_20Sum, color: "#0ea5b7" },
    { name: "21–50", value: t21_50Sum, color: "#7dd3fc" },
    { name: "Rest", value: restLtm, color: "#cbd5e1" },
  ];

  const greenN = top50.filter((c) => c.healthBand === "green").length;
  const amberN = top50.filter((c) => c.healthBand === "amber").length;
  const redN = top50.filter((c) => c.healthBand === "red").length;
  const bandsData = [
    { name: "Green", value: greenN, color: "#16a34a" },
    { name: "Amber", value: amberN, color: "#f59e0b" },
    { name: "Red", value: redN, color: "#dc2626" },
  ];

  const attention = [...top50]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 3);

  const top50Sum = top10Sum + t11_20Sum + t21_50Sum;
  const top50PctOfRegion = (top50Sum / totalLtm) * 100;

  return (
    <PageShell
      title="Whales"
      subtitle={`Top 50 ${region} accounts by LTM revenue — protect this revenue first.`}
    >
      {insight ? (
        <InsightBanner
          bodyMarkdown={insight.bodyMarkdown}
          generatedAt={insight.generatedAt}
          dataSnapshotSummary={insight.dataSnapshotSummary}
          insightType={insight.insightType}
          region={insight.region}
          nameToIdMap={nameToIdMap}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top-50 share of LTM revenue</CardTitle>
            <CardDescription>{formatPct(top50PctOfRegion)} of {region} revenue.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={top50ShareData}
              tooltipFormatter={(v) => formatCurrency(v, region)}
              centerLabel={{ value: formatPct(top50PctOfRegion, 0), sub: "in top 50" }}
              height={220}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Whale health distribution</CardTitle>
            <CardDescription>{redN} red · {amberN} amber · {greenN} green of {top50.length}.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={bandsData}
              tooltipFormatter={(v) => `${v} accounts`}
              centerLabel={{ value: `${redN + amberN}`, sub: "need attention" }}
              height={220}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Whales needing attention this week</CardTitle>
            <CardDescription>Worst three health scores in your top 50.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {attention.map((c) => (
              <Link
                key={c.id}
                href={`/account/${c.id}`}
                className="gtse-tile block rounded-sm border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <HealthBadge band={c.healthBand} score={c.healthScore} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(c.ltmRevenue, region)} LTM · {c.daysSinceLastOrder}d since last order · cadence ~{c.personalCadenceDays ?? "?"}d
                </div>
                <div className="mt-2 text-xs">
                  <span className="font-medium">Recommended: </span>
                  <span className="text-muted-foreground">
                    {c.lapseRatio >= 1.5
                      ? `Same-day call from ${c.ownerName}.`
                      : c.healthBand === "amber"
                        ? `Check-in call from ${c.ownerName} this week.`
                        : `Quarterly review on schedule.`}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Top 50 {region} whales</CardTitle>
            <CardDescription>
              Sortable. {top50.length} accounts representing {formatCurrency(top50Sum, region)} LTM revenue.
            </CardDescription>
          </div>
          <Button asChild size="sm" className="bg-gtse-orange hover:bg-gtse-orange-dark">
            <Link href={targetsUrl({ region, whaleFlag: true })}>
              <Download className="h-3.5 w-3.5" /> Open as list / export
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {HEAD.map((h) => (
                  <TableHead
                    key={h.key}
                    onClick={() => onSort(h.key)}
                    className={`cursor-pointer select-none ${h.align === "right" ? "text-right" : ""}`}
                  >
                    {h.label}
                    {sortKey === h.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </TableHead>
                ))}
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/account/${c.id}`} className="block hover:text-gtse-orange">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.industry} · {c.region_subdiv}</div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.ownerName}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(c.ltmRevenue, region)}</TableCell>
                  <TableCell className="text-right">{c.concentrationPctL90d.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatDate(c.lastOrderDate)}</TableCell>
                  <TableCell className="text-right">{c.daysSinceLastOrder}d</TableCell>
                  <TableCell className="text-right">{c.personalCadenceDays ?? "—"}d</TableCell>
                  <TableCell><LapseBadge ratio={c.lapseRatio} /></TableCell>
                  <TableCell><HealthBadge band={c.healthBand} score={c.healthScore} /></TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs text-gtse-orange">
                      <Link href={`/account/${c.id}`}>Open →</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
