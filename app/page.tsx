"use client";

import Link from "next/link";
import {
  ArrowRight, BarChart3, Crown, AlertTriangle, RefreshCw, Layers,
  HeartPulse, Network, Boxes, Sparkles, Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { InsightBanner } from "@/components/insight-banner";
import { DonutChart } from "@/components/charts/donut-chart";
import { KPIS_UK, KPIS_US, COMPANIES_UK, COMPANIES_US, insightOf } from "@/lib/mock-data";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useRegion } from "@/components/region-context";

const TILES = [
  { href: "/targets", title: "Target builder", desc: "Slice the customer base, export to CSV", icon: Target, featured: true },
  { href: "/kpis", title: "KPIs", desc: "LTV, AOV, churn, concentration", icon: BarChart3 },
  { href: "/whales", title: "Whales", desc: "Top 50 — protect the revenue", icon: Crown },
  { href: "/lapsed", title: "Lapsed", desc: "Reactivation priorities", icon: AlertTriangle },
  { href: "/reorder", title: "Reorder feed", desc: "Predicted reorders this week", icon: RefreshCw },
  { href: "/rfm", title: "RFM", desc: "Recency × frequency × monetary", icon: Layers },
  { href: "/health", title: "Health score", desc: "Today's amber & red movers", icon: HeartPulse },
  { href: "/crosssell", title: "Cross-sell", desc: "Whitespace & peer-basket lift", icon: Network },
  { href: "/segments", title: "Segments", desc: "Defined trigger + owner per segment", icon: Boxes },
  { href: "/insights", title: "Insights hub", desc: "All AI insights in one feed", icon: Sparkles },
];

function bandStats(companies: { healthBand: "green" | "amber" | "red" }[]) {
  const green = companies.filter((c) => c.healthBand === "green").length;
  const amber = companies.filter((c) => c.healthBand === "amber").length;
  const red = companies.filter((c) => c.healthBand === "red").length;
  return [
    { name: "Green", value: green, color: "#16a34a" },
    { name: "Amber", value: amber, color: "#f59e0b" },
    { name: "Red", value: red, color: "#dc2626" },
  ];
}

function RegionTile({ region }: { region: "UK" | "US" }) {
  const k = region === "UK" ? KPIS_UK : KPIS_US;
  const cs = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  const ltm = cs.reduce((s, c) => s + c.ltmRevenue, 0);
  const bands = bandStats(cs);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{region === "UK" ? "🇬🇧" : "🇺🇸"}</span>
          <div>
            <CardTitle>{region} customer base</CardTitle>
            <p className="text-xs text-muted-foreground">As of 7 May 2026</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Total customers</div>
              <div className="text-xl font-semibold">{formatNumber(k.totalCustomers)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Active LTM</div>
              <div className="text-xl font-semibold">{formatNumber(k.activeCustomersLtm)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">LTM revenue</div>
              <div className="text-xl font-semibold">{formatCurrency(ltm, region)}</div>
            </div>
          </div>
          <div className="col-span-2">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Health bands</div>
            <DonutChart
              data={bands}
              height={160}
              innerRadius={42}
              outerRadius={62}
              centerLabel={{ value: formatNumber(k.totalCustomers), sub: "accounts" }}
              tooltipFormatter={(v) => `${v} accounts`}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/kpis">
              Open dashboards <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { region } = useRegion();
  const monthly = insightOf(region, "monthly_narrative")!;

  return (
    <PageShell
      title="Project Whale"
      subtitle="Customer database intelligence for UK and US."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <RegionTile region="UK" />
        <RegionTile region="US" />
      </div>

      <InsightBanner
        bodyMarkdown={monthly.bodyMarkdown}
        generatedAt={monthly.generatedAt}
        dataSnapshotSummary={monthly.dataSnapshotSummary}
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight gtse-h2-underline">Dashboards</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map(({ href, title, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="gtse-tile group flex items-center gap-3 rounded-sm border bg-card p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-gtse-teal text-white transition-colors group-hover:bg-gtse-orange">
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
          ))}
        </div>
      </section>
    </PageShell>
  );
}
