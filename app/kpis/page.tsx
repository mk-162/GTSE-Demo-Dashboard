"use client";

import { useRegion } from "@/components/region-context";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineSeriesChart } from "@/components/charts/line-chart";
import { BarSeriesChart } from "@/components/charts/bar-chart";
import { kpisByRegion, insightOf, COMPANIES_UK, COMPANIES_US } from "@/lib/mock-data";
import { formatCurrency, formatPct, formatNumber } from "@/lib/utils";

export default function KpisPage() {
  const { region } = useRegion();
  const k = kpisByRegion(region);
  const insight = insightOf(region, "kpi_summary")!;
  const cs = region === "UK" ? COMPANIES_UK : COMPANIES_US;

  // LTV histogram — 8 buckets log-spaced
  const ltvBuckets = [0, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 1_000_000];
  const ltvHist = ltvBuckets.slice(0, -1).map((min, i) => {
    const max = ltvBuckets[i + 1];
    const count = cs.filter((c) => c.lifetimeRevenue >= min && c.lifetimeRevenue < max).length;
    const labelLow = min === 0 ? "0" : formatCurrency(min, region);
    const labelHigh = max >= 1_000_000 ? "+" : formatCurrency(max, region);
    return { range: max >= 1_000_000 ? `${labelLow}+` : `${labelLow}–${labelHigh}`, count };
  });

  // Concentration stacked bar
  const top10 = k.customerConcentrationTop10;
  const next10 = k.customerConcentrationTop20 - k.customerConcentrationTop10;
  const next30 = k.customerConcentrationTop50 - k.customerConcentrationTop20;
  const rest = 100 - k.customerConcentrationTop50;
  const concentrationData = [{
    label: "LTM revenue",
    "Top 10": Math.max(0, top10),
    "11–20": Math.max(0, next10),
    "21–50": Math.max(0, next30),
    "Rest": Math.max(0, rest),
  }];

  // AOV vs Median
  const aovVsMedian = [
    { kind: "AOV", value: k.aov },
    { kind: "Median order", value: k.medianOrderValue },
  ];

  // Three churn definitions
  const churnDefs = [
    { def: "Cadence-based", value: k.churnRateCadence },
    { def: "12-month rolling", value: k.churnRateRolling },
    { def: "Cohort-based", value: k.churnRateCohort },
  ];

  return (
    <PageShell
      title="KPI overview"
      subtitle={`Headline numbers for the ${region} customer base. Trends shown over the last 12 months.`}
    >
      <InsightBanner
        bodyMarkdown={insight.bodyMarkdown}
        generatedAt={insight.generatedAt}
        dataSnapshotSummary={insight.dataSnapshotSummary}
        insightType={insight.insightType}
        region={insight.region}
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="LTV (median)"
          value={formatCurrency(k.ltvDistribution.p50, region)}
          trend={{ direction: "up", value: "+5.2% vs Q-1" }}
          caption={`p90: ${formatCurrency(k.ltvDistribution.p90, region)}`}
        />
        <KpiCard
          label="AOV"
          value={formatCurrency(k.aov, region)}
          trend={{ direction: "up", value: "+1.8% vs Q-1" }}
        />
        <KpiCard
          label="Median order"
          value={formatCurrency(k.medianOrderValue, region)}
          trend={{ direction: "flat", value: "Flat" }}
        />
        <KpiCard
          label="Churn (cadence)"
          value={formatPct(k.churnRateCadence)}
          trend={{ direction: "up", value: "+3.5pp vs Q-1", positiveIsGood: false }}
          caption={`vs ${formatPct(k.churnRateCohort)} cohort / ${formatPct(k.churnRateRolling)} rolling`}
        />
        <KpiCard
          label="Top-50 concentration"
          value={formatPct(k.customerConcentrationTop50)}
          trend={{ direction: "up", value: "+1.4pp vs Q-1", positiveIsGood: false }}
        />
        <KpiCard
          label="Repeat rate"
          value={formatPct(k.repeatRate)}
          trend={{ direction: "up", value: "+0.6pp vs Q-1" }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>LTM revenue trend</CardTitle>
            <CardDescription>Monthly revenue, last 12 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <LineSeriesChart
              data={k.monthlyTrend}
              xKey="month"
              series={[{ key: "revenue", label: "Revenue", color: "#0ea5b7" }]}
              yFormatter={(v) => formatCurrency(v, region)}
              height={260}
              showLegend={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>LTV distribution</CardTitle>
            <CardDescription>
              Median {formatCurrency(k.ltvDistribution.p50, region)} ·
              p75 {formatCurrency(k.ltvDistribution.p75, region)} ·
              p90 {formatCurrency(k.ltvDistribution.p90, region)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={ltvHist}
              xKey="range"
              series={[{ key: "count", label: "Customers", color: "#0ea5b7" }]}
              showLegend={false}
              yFormatter={(v) => formatNumber(v)}
              height={260}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AOV vs Median order</CardTitle>
            <CardDescription>The gap is your whale skew — AOV ≫ median means a few large orders pulling up the average.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={aovVsMedian}
              xKey="kind"
              series={[{ key: "value", label: "Order value", color: "#0ea5b7" }]}
              showLegend={false}
              yFormatter={(v) => formatCurrency(v, region)}
              height={240}
              cellColors={["#0ea5b7", "#7dd3fc"]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer concentration</CardTitle>
            <CardDescription>How LTM revenue distributes across the top accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={concentrationData}
              xKey="label"
              series={[
                { key: "Top 10", label: "Top 10", color: "#075985" },
                { key: "11–20", label: "11–20", color: "#0ea5b7" },
                { key: "21–50", label: "21–50", color: "#7dd3fc" },
                { key: "Rest", label: "Rest", color: "#cbd5e1" },
              ]}
              stacked
              layout="horizontal"
              yFormatter={(v) => `${v}%`}
              height={140}
              showLegend
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Three definitions of churn</CardTitle>
          <CardDescription>
            Cadence-based is recommended as the operational metric — it catches drift earliest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarSeriesChart
            data={churnDefs}
            xKey="def"
            series={[{ key: "value", label: "Churn %", color: "#dc2626" }]}
            showLegend={false}
            yFormatter={(v) => formatPct(v)}
            height={220}
            cellColors={["#dc2626", "#f59e0b", "#0ea5b7"]}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
