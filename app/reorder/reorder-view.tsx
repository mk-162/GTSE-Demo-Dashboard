"use client";

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SKU_BY_CODE } from "@/lib/skus";
import type { Company, Insight, Region } from "@/lib/data/contracts";
import { BarSeriesChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { formatCurrency, formatDate } from "@/lib/utils";

function daysVsPredicted(c: Company): number {
  return Math.round(
    (new Date(c.predictedNextOrderDate).getTime() - new Date("2026-05-07").getTime()) / (1000 * 60 * 60 * 24),
  );
}

function expectedOrderValue(c: Company): number {
  const cadence = c.personalCadenceDays ?? 90;
  const orders = Math.max(1, Math.round(365 / cadence));
  return Math.round(c.ltmRevenue / orders);
}

function ReorderTable({ rows, region }: { rows: Company[]; region: Region }) {
  return (
    <Card>
      <CardContent className="px-0 pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Predicted reorder</TableHead>
              <TableHead className="text-right">Days vs predicted</TableHead>
              <TableHead className="text-right">Cadence</TableHead>
              <TableHead>Top reorder SKUs</TableHead>
              <TableHead className="text-right">Expected order value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const dvp = daysVsPredicted(c);
              const tone = dvp < 0 ? "red" : dvp <= 7 ? "amber" : "green";
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/account/${c.id}`} className="block hover:text-gtse-orange">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.industry}</div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.ownerName}</TableCell>
                  <TableCell className="text-right">{formatDate(c.predictedNextOrderDate)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tone}>{dvp >= 0 ? `+${dvp}d` : `${dvp}d`}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.personalCadenceDays ?? "—"}d</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {c.top3ReorderSkus.slice(0, 2).map((s) => (
                        <span key={s} className="text-xs">
                          <span className="font-mono text-muted-foreground">{s}</span>
                          <span className="text-muted-foreground"> · </span>
                          {SKU_BY_CODE[s]?.name ?? "—"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(expectedOrderValue(c), region)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type Props = {
  region: Region;
  insight?: Insight;
  all: Company[];
  nameToIdMap: Record<string, string>;
};

export function ReorderView({ region, insight, all, nameToIdMap }: Props) {
  const overdue: Company[] = [];
  const thisWeek: Company[] = [];
  const nextWeek: Company[] = [];
  const next30: Company[] = [];

  for (const c of all) {
    if (c.lifetimeOrders < 3) continue;
    const dvp = daysVsPredicted(c);
    if (dvp < 0 && dvp >= -45) overdue.push(c);
    else if (dvp >= 0 && dvp <= 7) thisWeek.push(c);
    else if (dvp >= 8 && dvp <= 14) nextWeek.push(c);
    else if (dvp >= 15 && dvp <= 30) next30.push(c);
  }

  const byEv = (a: Company, b: Company) => expectedOrderValue(b) - expectedOrderValue(a);
  overdue.sort(byEv);
  thisWeek.sort(byEv);
  nextWeek.sort(byEv);
  next30.sort(byEv);

  const forecast = Array.from({ length: 8 }, (_, w) => {
    const lo = w * 7;
    const hi = lo + 6;
    const value = all
      .filter((c) => c.lifetimeOrders >= 3)
      .filter((c) => {
        const dvp = daysVsPredicted(c);
        return dvp >= lo && dvp <= hi;
      })
      .reduce((s, c) => s + expectedOrderValue(c), 0);
    return { week: `Wk ${w + 1}`, value };
  });

  const cadenceCohorts = (() => {
    const monthly = all.filter((c) => c.personalCadenceDays && c.personalCadenceDays <= 45).length;
    const quarterly = all.filter((c) => c.personalCadenceDays && c.personalCadenceDays > 45 && c.personalCadenceDays <= 120).length;
    const twiceYear = all.filter((c) => c.personalCadenceDays && c.personalCadenceDays > 120 && c.personalCadenceDays <= 240).length;
    const lessFrequent = all.filter((c) => c.personalCadenceDays && c.personalCadenceDays > 240).length;
    return [
      { name: "Monthly (~30d)", value: monthly, color: "#075985" },
      { name: "Quarterly (~90d)", value: quarterly, color: "#0ea5b7" },
      { name: "Twice-a-year (~180d)", value: twiceYear, color: "#7dd3fc" },
      { name: "Less frequent", value: lessFrequent, color: "#cbd5e1" },
    ];
  })();

  const overdueCount = overdue.length;
  const totalForecast = forecast.reduce((s, f) => s + f.value, 0);

  return (
    <PageShell
      title="Reorder feed"
      subtitle={`Predicted reorders for the ${region} customer base, derived from each account's personal cadence.`}
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reorder revenue forecast</CardTitle>
            <CardDescription>
              Expected reorder value for the next 8 weeks. Total: {formatCurrency(totalForecast, region)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={forecast}
              xKey="week"
              series={[{ key: "value", label: "Expected value", color: "#0ea5b7" }]}
              yFormatter={(v) => formatCurrency(v, region)}
              height={220}
              showLegend={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadence cohorts</CardTitle>
            <CardDescription>How customers split across reorder frequencies.</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={cadenceCohorts}
              tooltipFormatter={(v) => `${v} accounts`}
              height={220}
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="urgent">
        <TabsList>
          <TabsTrigger value="urgent">
            Urgent (overdue) <Badge variant="red" className="ml-2">{overdueCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="this-week">
            This week <Badge variant="amber" className="ml-2">{thisWeek.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="next-week">
            Next week <Badge variant="blue" className="ml-2">{nextWeek.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="next-30">
            Next 30 days <Badge variant="secondary" className="ml-2">{next30.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="urgent"><ReorderTable rows={overdue} region={region} /></TabsContent>
        <TabsContent value="this-week"><ReorderTable rows={thisWeek} region={region} /></TabsContent>
        <TabsContent value="next-week"><ReorderTable rows={nextWeek} region={region} /></TabsContent>
        <TabsContent value="next-30"><ReorderTable rows={next30} region={region} /></TabsContent>
      </Tabs>
    </PageShell>
  );
}
