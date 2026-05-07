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

const SEGMENT_HREF: Partial<Record<Segment, string>> = {
  Whales: "/whales",
  Lapsed: "/lapsed",
  ReadyForReorder: "/reorder",
  CrossSell: "/crosssell",
};

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
          const href = SEGMENT_HREF[seg.segment];
          return (
            <Card key={seg.segment} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Accounts</div>
                    <div className="text-xl font-semibold">{formatNumber(seg.count)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">LTM revenue</div>
                    <div className="text-xl font-semibold">
                      {seg.totalRevenueLtm > 0 ? formatCurrency(seg.totalRevenueLtm, region) : "—"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommended action</div>
                  <p className="text-sm">{seg.recommendedAction}</p>
                </div>
                <div className="flex items-center justify-between">
                  {href ? (
                    <Button asChild variant="link" className="h-auto px-0 text-sm">
                      <Link href={href}>
                        Open dashboard <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No dedicated dashboard</span>
                  )}
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
