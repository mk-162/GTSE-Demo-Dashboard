"use client";

import { useRegion } from "@/components/region-context";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarSeriesChart } from "@/components/charts/bar-chart";
import { COMPANIES_UK, COMPANIES_US, insightOf, type RfmSegment } from "@/lib/mock-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SEGMENTS: { key: RfmSegment; label: string; description: string; color: string }[] = [
  { key: "Champion", label: "Champions", description: "Recent, frequent, high-spend.", color: "#16a34a" },
  { key: "Loyal", label: "Loyal", description: "Reliable repeaters.", color: "#0ea5b7" },
  { key: "Promising", label: "Promising", description: "Recent, low frequency — earn their second order.", color: "#7dd3fc" },
  { key: "AtRisk", label: "At risk", description: "Used to buy frequently, gone quiet.", color: "#f59e0b" },
  { key: "CannotLose", label: "Cannot lose", description: "High historical value, gone quiet — VIP win-back.", color: "#dc2626" },
  { key: "Hibernating", label: "Hibernating", description: "Long inactive, low value.", color: "#6b7280" },
  { key: "New", label: "New", description: "First order in last 90 days.", color: "#3b82f6" },
];

const SEGMENT_ACTIONS: Record<RfmSegment, { action: string; owner: "Marketing" | "AE" | "Hybrid" }> = {
  Champion: { action: "Reward + upsell. Quarterly AE check-in.", owner: "AE" },
  Loyal: { action: "Cross-sell whitespace SKUs.", owner: "Marketing" },
  Promising: { action: "Onboarding sequence + 30-day check-in.", owner: "Hybrid" },
  AtRisk: { action: "5-step reactivation; AE call after step 3.", owner: "Hybrid" },
  CannotLose: { action: "Same-day senior AE outreach.", owner: "AE" },
  Hibernating: { action: "Annual win-back; otherwise leave to age out.", owner: "Marketing" },
  New: { action: "Onboarding sequence + AE intro.", owner: "Hybrid" },
};

export default function RfmPage() {
  const { region } = useRegion();
  const insight = insightOf(region, "cross_segment_surprise")!;
  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;

  // Build heatmap: 5 (R rows top-down) × 5 (F cols left-right)
  // grid[r][f] = { count, revenue }
  type Cell = { count: number; revenue: number; segments: Record<RfmSegment, number> };
  const grid: Cell[][] = [];
  for (let r = 5; r >= 1; r--) {
    const row: Cell[] = [];
    for (let f = 1; f <= 5; f++) {
      const matching = all.filter((c) => c.rfmScores.r === r && c.rfmScores.f === f);
      const segments: Record<RfmSegment, number> = {
        Champion: 0, Loyal: 0, AtRisk: 0, CannotLose: 0, Hibernating: 0, New: 0, Promising: 0,
      };
      for (const m of matching) segments[m.rfmSegment] += 1;
      row.push({
        count: matching.length,
        revenue: matching.reduce((s, c) => s + c.ltmRevenue, 0),
        segments,
      });
    }
    grid.push(row);
  }

  const maxCount = Math.max(1, ...grid.flat().map((c) => c.count));

  // Counts and revenue per segment
  const segmentRows = SEGMENTS.map(({ key, label, description, color }) => {
    const cs = all.filter((c) => c.rfmSegment === key);
    const revenue = cs.reduce((s, c) => s + c.ltmRevenue, 0);
    const aov = cs.length ? Math.round(revenue / Math.max(1, cs.length)) : 0;
    return { key, label, description, color, count: cs.length, revenue, aov };
  });

  const byCount = [...segmentRows].sort((a, b) => b.count - a.count);
  const byRevenue = [...segmentRows].sort((a, b) => b.revenue - a.revenue);

  function dominantSegment(cell: Cell): { name: RfmSegment; count: number } | null {
    let best: RfmSegment | null = null;
    let bestN = 0;
    (Object.keys(cell.segments) as RfmSegment[]).forEach((k) => {
      if (cell.segments[k] > bestN) { best = k; bestN = cell.segments[k]; }
    });
    return best ? { name: best, count: bestN } : null;
  }

  return (
    <PageShell
      title="RFM segmentation"
      subtitle={`Recency × Frequency × Monetary — five-band scoring across all ${region} customers.`}
    >
      <InsightBanner
        bodyMarkdown={insight.bodyMarkdown}
        generatedAt={insight.generatedAt}
        dataSnapshotSummary={insight.dataSnapshotSummary}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recency × Frequency heatmap</CardTitle>
          <CardDescription>
            Y axis: Recency (5 = most recent). X axis: Frequency (5 = most frequent).
            Cell shading reflects customer count; hover for details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="ml-12 grid grid-cols-5 gap-1 pb-1 text-center text-xs text-muted-foreground">
                {[1, 2, 3, 4, 5].map((f) => (
                  <div key={f}>F = {f}</div>
                ))}
              </div>
              {grid.map((row, idx) => {
                const r = 5 - idx;
                return (
                  <div key={r} className="mb-1 flex items-stretch gap-1">
                    <div className="flex w-12 items-center text-xs text-muted-foreground">R = {r}</div>
                    <div className="grid flex-1 grid-cols-5 gap-1">
                      {row.map((cell, f) => {
                        const intensity = cell.count / maxCount;
                        const bgAlpha = 0.08 + intensity * 0.85;
                        const dom = dominantSegment(cell);
                        return (
                          <div
                            key={f}
                            className="group relative rounded-md border p-2 text-center transition-colors"
                            style={{ backgroundColor: `rgba(14, 165, 183, ${bgAlpha})` }}
                            title={`R=${r}, F=${f + 1} · ${cell.count} accounts · ${formatCurrency(cell.revenue, region)} LTM${dom ? ` · top segment: ${dom.name}` : ""}`}
                          >
                            <div className="text-base font-semibold">{cell.count}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {cell.count > 0 ? formatCurrency(cell.revenue, region) : "—"}
                            </div>
                            {dom && cell.count > 0 ? (
                              <div className="mt-0.5 text-[10px] font-medium">{dom.name}</div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Segments by count</CardTitle>
            <CardDescription>How many accounts in each RFM segment.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={byCount.map((s) => ({ name: s.label, count: s.count }))}
              xKey="name"
              series={[{ key: "count", label: "Accounts", color: "#0ea5b7" }]}
              yFormatter={(v) => formatNumber(v)}
              showLegend={false}
              height={260}
              cellColors={byCount.map((s) => s.color)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segments by LTM revenue</CardTitle>
            <CardDescription>Where the money currently sits.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={byRevenue.map((s) => ({ name: s.label, revenue: s.revenue }))}
              xKey="name"
              series={[{ key: "revenue", label: "LTM revenue", color: "#0ea5b7" }]}
              yFormatter={(v) => formatCurrency(v, region)}
              showLegend={false}
              height={260}
              cellColors={byRevenue.map((s) => s.color)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segment table</CardTitle>
          <CardDescription>Definition, size, value, and recommended action per RFM segment.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead>Definition</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">LTM revenue</TableHead>
                <TableHead className="text-right">Avg LTM</TableHead>
                <TableHead>Recommended action</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentRows.map((s) => (
                <TableRow key={s.key}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="font-medium">{s.label}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.revenue, region)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.aov, region)}</TableCell>
                  <TableCell className="text-sm">{SEGMENT_ACTIONS[s.key].action}</TableCell>
                  <TableCell><Badge variant="secondary">{SEGMENT_ACTIONS[s.key].owner}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
