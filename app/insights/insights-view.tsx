"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsightBanner } from "@/components/insight-banner";
import { MessageMarkdown } from "@/components/message-markdown";
import type { Insight, InsightType, Region } from "@/lib/data/contracts";

const TYPE_LABEL: Record<InsightType, string> = {
  kpi_summary: "KPI summary",
  whale_attention: "Whale attention",
  lapsed_priorities: "Lapsed priorities",
  reorder_urgency: "Reorder urgency",
  cross_segment_surprise: "Segment surprise",
  monthly_narrative: "Monthly narrative",
  health_movers: "Health movers",
  cross_sell_opportunities: "Cross-sell opportunities",
};

function fmt(iso: string): string {
  const d = new Date(iso);
  const today = new Date("2026-05-07");
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isToday) return `Today, ${time}`;
  if (isYest) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + time;
}

type Props = {
  region: Region;
  allInsights: Insight[];
  featured?: Insight;
  nameToIdMap: Record<string, string>;
};

export function InsightsView({ region: globalRegion, allInsights, featured, nameToIdMap }: Props) {
  const [region, setRegion] = React.useState<"All" | "UK" | "US">("All");
  const [type, setType] = React.useState<"All" | InsightType>("All");

  const filtered = allInsights.filter((i) => {
    if (region !== "All" && i.region !== region) return false;
    if (type !== "All" && i.insightType !== type) return false;
    return true;
  }).sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

  return (
    <PageShell
      title="Insights hub"
      subtitle="All AI-generated insights across both regions and every dashboard. Reverse-chronological."
    >
      {featured ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Featured · Monthly narrative ({globalRegion})
                </CardTitle>
                <CardDescription>The long-form summary your CEO should read first thing.</CardDescription>
              </div>
              <Badge variant="blue">Featured</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <InsightBanner
              bodyMarkdown={featured.bodyMarkdown}
              generatedAt={featured.generatedAt}
              dataSnapshotSummary={featured.dataSnapshotSummary}
              insightType={featured.insightType}
              region={featured.region}
              nameToIdMap={nameToIdMap}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Narrow the feed by region or insight type.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Region</span>
                <Select value={region} onValueChange={(v) => setRegion(v as typeof region)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Both</SelectItem>
                    <SelectItem value="UK">UK</SelectItem>
                    <SelectItem value="US">US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Type</span>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All types</SelectItem>
                    {(Object.keys(TYPE_LABEL) as InsightType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {filtered.map((i) => (
          <div key={i.id} className="overflow-hidden rounded-lg border-l-4 border-l-primary bg-primary/5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Badge variant="blue">{TYPE_LABEL[i.insightType]}</Badge>
                <Badge variant="secondary">{i.region}</Badge>
                <span className="text-xs text-muted-foreground">{fmt(i.generatedAt)}</span>
              </div>
            </div>
            <div className="px-5 py-4">
              <MessageMarkdown text={i.bodyMarkdown} nameToIdMap={nameToIdMap} />
            </div>
            <div className="px-5 pb-4 text-xs italic text-muted-foreground">{i.dataSnapshotSummary}</div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No insights match the current filters.
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
