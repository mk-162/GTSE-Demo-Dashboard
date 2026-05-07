"use client";

import { useRegion } from "@/components/region-context";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarSeriesChart } from "@/components/charts/bar-chart";
import { COMPANIES_UK, COMPANIES_US, insightOf, SKU_BY_CODE, type Company } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

function whitespaceValue(c: Company): number {
  // Heuristic mock: 12% of LTM revenue × number of "missing" SKUs they could attach (3)
  return Math.round(c.ltmRevenue * 0.36);
}

export default function CrossSellPage() {
  const { region } = useRegion();
  const insight = insightOf(region, "cross_sell_opportunities")!;
  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;

  // Top 30 by whitespace value among healthy enough accounts
  const candidates = all
    .filter((c) => c.healthBand !== "red" && c.lifetimeOrders >= 4 && c.lapseRatio < 1.5)
    .sort((a, b) => whitespaceValue(b) - whitespaceValue(a))
    .slice(0, 30);

  // Most-frequently missing SKUs across all candidates
  const skuCounts: Record<string, number> = {};
  for (const c of candidates) {
    for (const s of c.top3CrossSellSkus) {
      skuCounts[s] = (skuCounts[s] ?? 0) + 1;
    }
  }
  const topMissing = Object.entries(skuCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sku, count]) => ({
      label: SKU_BY_CODE[sku]?.name ?? sku,
      count,
    }));

  // Peer-basket lift — small example association rules with mock lift values
  const associations = [
    { rule: "PPE Hi-Vis Vests → Hard Hats", lift: 4.2 },
    { rule: "Floor Marker Tape → Aisle Marking Paint", lift: 3.8 },
    { rule: "First Aid Kit 50P → Eye Wash Station", lift: 3.6 },
    { rule: "Spill Kit Oil 240L → Drain Cover Mat", lift: 3.4 },
    { rule: "Safety Signs A4 Set → Fire Extinguisher Sign", lift: 3.1 },
    { rule: "Traffic Cones → Plastic Road Barriers", lift: 2.9 },
    { rule: "LOTO Padlock Pack → LOTO Station 12", lift: 2.7 },
    { rule: "Industrial Markers → Industrial Crayons", lift: 2.5 },
  ];

  return (
    <PageShell
      title="Cross-sell whitespace"
      subtitle={`Active accounts in the ${region} book that under-buy SKUs their peers regularly purchase.`}
    >
      <InsightBanner
        bodyMarkdown={insight.bodyMarkdown}
        generatedAt={insight.generatedAt}
        dataSnapshotSummary={insight.dataSnapshotSummary}
      />

      <Card>
        <CardHeader>
          <CardTitle>Top 30 accounts by whitespace opportunity</CardTitle>
          <CardDescription>
            Scoring favours active accounts with growing baskets. Estimated whitespace = peer-basket-implied annual revenue if missing SKUs attached.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Top missing SKUs</TableHead>
                <TableHead className="text-right">Est. whitespace / yr</TableHead>
                <TableHead>Recommended approach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.industry} · LTM {formatCurrency(c.ltmRevenue, region)}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.ownerName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {c.top3CrossSellSkus.map((s) => (
                        <span key={s} className="text-xs">
                          <span className="font-mono text-muted-foreground">{s}</span>{" · "}
                          {SKU_BY_CODE[s]?.name ?? "—"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(whitespaceValue(c), region)}</TableCell>
                  <TableCell className="text-sm">
                    {c.lifetimeOrders >= 12
                      ? "AE leads with peer case study at quarterly review."
                      : "Targeted email sequence + AE follow-up if engaged."}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most-frequently missing SKUs</CardTitle>
            <CardDescription>Across the whitespace shortlist — likely your highest-volume cross-sell wins.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={topMissing}
              xKey="label"
              series={[{ key: "count", label: "Accounts missing", color: "#0ea5b7" }]}
              showLegend={false}
              layout="horizontal"
              height={340}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peer-basket lift</CardTitle>
            <CardDescription>Top association rules — &quot;customers who buy A also buy B&quot; with lift &gt; 2.5.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={associations}
              xKey="rule"
              series={[{ key: "lift", label: "Lift", color: "#16a34a" }]}
              yFormatter={(v) => `${v.toFixed(1)}×`}
              showLegend={false}
              layout="horizontal"
              height={340}
            />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
