"use client";

import Link from "next/link";
import { ArrowRight, Crown, AlertTriangle, RefreshCw, Sparkle, Compass, Sun, Snowflake, Sprout, Activity, Network } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRegion } from "@/components/region-context";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { segmentsByRegion, type Segment } from "@/lib/mock-data";
import { targetsUrl } from "@/lib/criteria-url";
import type { TargetCriteria } from "@/lib/criteria-types";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SEGMENT_ICON: Record<Segment, LucideIcon> = {
  Whales: Crown,
  Lapsed: AlertTriangle,
  Slipping: Activity,
  Ideal: Sparkle,
  Prospects: Compass,
  ReadyForReorder: RefreshCw,
  Hibernating: Snowflake,
  New: Sprout,
  Winback: Sun,
  CrossSell: Network,
};

const SEGMENT_LABEL: Record<Segment, string> = {
  Whales: "Whales",
  Lapsed: "Lapsed",
  Slipping: "Slipping",
  Ideal: "Ideal",
  Prospects: "Prospects",
  ReadyForReorder: "Ready for repeat",
  Hibernating: "Hibernating",
  New: "New",
  Winback: "Win-back",
  CrossSell: "Cross-sell",
};

// Each Phase-2 segment maps to a Target builder filter slice.
// Clicking "View N accounts" on a segment card opens the list.
function segmentTargetUrl(segment: Segment, region: "UK" | "US"): string {
  const base: Partial<TargetCriteria> = { region };
  switch (segment) {
    case "Whales":
      return targetsUrl({ ...base, whaleFlag: true });
    case "Lapsed":
      return targetsUrl({ ...base, lapseRatio: { min: 2.0, max: 10 } });
    case "Slipping":
      return targetsUrl({ ...base, lapseRatio: { min: 1.0, max: 1.99 } });
    case "Ideal":
      return targetsUrl({
        ...base,
        healthBands: ["green"],
        lifetimeOrders: { min: 6, max: 200 },
        lapseRatio: { min: 0, max: 0.9 },
      });
    case "Prospects":
      return targetsUrl({ ...base, lifetimeOrders: { min: 0, max: 0 } });
    case "ReadyForReorder":
      return targetsUrl({ ...base, lapseRatio: { min: 0.85, max: 1.15 }, healthBands: ["green", "amber"] });
    case "Hibernating":
      return targetsUrl({ ...base, daysSinceLastOrder: { min: 540, max: 5000 }, lifetimeRevenue: { min: 0, max: 5000 } });
    case "New":
      return targetsUrl({ ...base, lifetimeOrders: { min: 1, max: 2 }, daysSinceLastOrder: { min: 0, max: 90 } });
    case "Winback":
      return targetsUrl({ ...base, lapseRatio: { min: 1.5, max: 10 }, buyerIntentActive: true });
    case "CrossSell":
      return targetsUrl({
        ...base,
        healthBands: ["green", "amber"],
        lifetimeOrders: { min: 5, max: 200 },
        lapseRatio: { min: 0, max: 1.5 },
      });
  }
}

const ORDER: Segment[] = [
  "Whales", "Lapsed", "Slipping", "Ideal", "Prospects",
  "ReadyForReorder", "Winback", "CrossSell", "New", "Hibernating",
];

export default function SegmentsPage() {
  const { region } = useRegion();
  const segments = segmentsByRegion(region);

  const orderMap = new Map(ORDER.map((s, i) => [s, i]));
  const sorted = [...segments].sort(
    (a, b) => (orderMap.get(a.segment) ?? 99) - (orderMap.get(b.segment) ?? 99),
  );

  return (
    <PageShell
      title="Segments overview"
      subtitle={`Phase 2 of Project Whale: every customer mapped to a segment with a defined trigger, owner and action. ${region} customer base.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((seg) => {
          const Icon = SEGMENT_ICON[seg.segment];
          const targetUrl = segmentTargetUrl(seg.segment, region);
          return (
            <Card key={seg.segment} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-gtse-teal text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{SEGMENT_LABEL[seg.segment]}</CardTitle>
                  </div>
                  <Badge variant="secondary">{seg.actionOwner}</Badge>
                </div>
                <CardDescription className="mt-2 text-sm">{seg.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="gtse-eyebrow text-muted-foreground">Accounts</div>
                    <div className="text-xl font-semibold">{formatNumber(seg.count)}</div>
                  </div>
                  <div>
                    <div className="gtse-eyebrow text-muted-foreground">LTM revenue</div>
                    <div className="text-xl font-semibold">
                      {seg.totalRevenueLtm > 0 ? formatCurrency(seg.totalRevenueLtm, region) : "—"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="gtse-eyebrow text-muted-foreground">Recommended action</div>
                  <p className="text-sm">{seg.recommendedAction}</p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button asChild size="sm" className="bg-gtse-orange hover:bg-gtse-orange-dark">
                    <Link href={targetUrl}>
                      View {formatNumber(seg.count)} {seg.count === 1 ? "account" : "accounts"} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    title="Mock-up only"
                  >
                    HubSpot →
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
