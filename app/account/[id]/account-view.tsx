"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Building2, Mail, MapPin, Phone, RefreshCw, Send, Sparkles, TrendingDown, TrendingUp,
  AlertTriangle, ExternalLink, Activity,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineSeriesChart } from "@/components/charts/line-chart";
import { HealthBadge, LapseBadge } from "@/components/health-badge";
import { ordersByMonth, topSkus } from "@/lib/order-helpers";
import type { Company, Order } from "@/lib/data/contracts";
import { targetsUrl } from "@/lib/criteria-url";
import { formatCurrency, formatCurrencyExact, formatDate, formatNumber } from "@/lib/utils";

type Props = {
  company: Company;
  orders: Order[];
};

export function AccountView({ company, orders }: Props) {
  const monthly = React.useMemo(() => ordersByMonth(orders), [orders]);
  const topSpendSkus = React.useMemo(() => topSkus(orders, 8), [orders]);
  const reversedOrders = React.useMemo(() => [...orders].reverse(), [orders]);

  const velocityChange = company.prior90dRevenue > 0
    ? ((company.l90dRevenue - company.prior90dRevenue) / company.prior90dRevenue) * 100
    : 0;
  const velocityDirection: "up" | "down" | "flat" = Math.abs(velocityChange) < 3 ? "flat" : velocityChange > 0 ? "up" : "down";

  const recommendation = (() => {
    if (company.healthBand === "red" && company.lapseRatio >= 1.5) {
      return {
        action: "Same-day senior AE call",
        rationale: `Account is in red health (${company.healthScore}) with a ${company.lapseRatio.toFixed(2)}× lapse ratio. ${company.daysSinceLastEngagement} days of AE silence. Single phone touch is the highest-leverage move.`,
        owner: company.ownerName,
        priority: "urgent" as const,
      };
    }
    if (company.lapseRatio >= 1.5 && company.buyerIntentActive) {
      return {
        action: "Same-day call — buyer intent active",
        rationale: `Lapsed account showing fresh website activity. Reach out before competitors do; lead with the SKUs they last reordered.`,
        owner: company.ownerName,
        priority: "urgent" as const,
      };
    }
    if (company.lapseRatio >= 1.5) {
      return {
        action: "Reactivation sequence + AE call after step 3",
        rationale: `${company.daysSinceLastOrder} days since last order on a typical ${company.personalCadenceDays ?? "?"} day cadence.`,
        owner: company.ownerName,
        priority: "high" as const,
      };
    }
    if (company.lapseRatio >= 1.0) {
      return {
        action: "Reorder reminder this week",
        rationale: `Slipping past natural cadence. Lead with a top-reorder SKU on automated reminder, escalate if no response.`,
        owner: "Marketing",
        priority: "medium" as const,
      };
    }
    if (company.healthBand === "amber") {
      return {
        action: `Check-in call from ${company.ownerName}`,
        rationale: `Health has dipped to amber. ${velocityChange < 0 ? `Basket shrunk ${Math.abs(velocityChange).toFixed(0)}% in last 90 days.` : "Worth a touch this week."}`,
        owner: company.ownerName,
        priority: "medium" as const,
      };
    }
    if (company.healthBand === "green" && company.lifetimeOrders >= 6) {
      return {
        action: "Cross-sell whitespace SKUs",
        rationale: `Healthy and on cadence. Three peer-basket SKUs they don't currently buy: ${company.top3CrossSellSkus.slice(0, 3).join(", ")}.`,
        owner: company.ownerName,
        priority: "low" as const,
      };
    }
    return {
      action: "Quarterly business review on schedule",
      rationale: "Account in stable shape. No immediate action required.",
      owner: company.ownerName,
      priority: "low" as const,
    };
  })();

  const priorityColor =
    recommendation.priority === "urgent" ? "red" :
    recommendation.priority === "high" ? "amber" :
    recommendation.priority === "medium" ? "amber" : "green";

  return (
    <PageShell
      title={company.name}
      subtitle={`${company.industry} · ${company.region_subdiv} · ${company.region} · ${company.sizeBand}${company.whaleFlag ? " · whale" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-card p-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/targets">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to list
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">Account ID: <span className="font-mono">{company.id}</span></span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={targetsUrl({ region: company.region, owners: [company.ownerName] })}>
              <Activity className="h-3.5 w-3.5" /> {company.ownerName}'s book
            </Link>
          </Button>
          <Button size="sm" disabled title="Phase 2 — coming when HubSpot integration ships">
            <Send className="h-3.5 w-3.5" /> Add to call list
            <Badge variant="outline" className="ml-1 text-[10px]">Phase 2</Badge>
          </Button>
          <Button variant="secondary" size="sm" disabled title="Phase 2 — HubSpot push">
            <ExternalLink className="h-3.5 w-3.5" /> Push to HubSpot
            <Badge variant="outline" className="ml-1 text-[10px]">Phase 2</Badge>
          </Button>
        </div>
      </div>

      <Card className={`border-2 ${priorityColor === "red" ? "border-red-500/40" : priorityColor === "amber" ? "border-amber-500/40" : "border-emerald-500/30"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gtse-orange" />
              <CardTitle className="text-base">Recommended action</CardTitle>
              <Badge variant={priorityColor}>{recommendation.priority}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">Owner: {recommendation.owner}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-base font-semibold">{recommendation.action}</p>
          <p className="mt-1 text-sm text-muted-foreground">{recommendation.rationale}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Lifetime revenue" value={formatCurrency(company.lifetimeRevenue, company.region)} />
        <Stat label="LTM revenue" value={formatCurrency(company.ltmRevenue, company.region)} accent />
        <Stat
          label="L90d revenue"
          value={formatCurrency(company.l90dRevenue, company.region)}
          subtext={
            <span className={`inline-flex items-center gap-1 ${velocityDirection === "up" ? "text-emerald-600" : velocityDirection === "down" ? "text-red-600" : "text-muted-foreground"}`}>
              {velocityDirection === "up" ? <TrendingUp className="h-3 w-3" /> : velocityDirection === "down" ? <TrendingDown className="h-3 w-3" /> : null}
              {velocityChange.toFixed(0)}% vs prior 90d
            </span>
          }
        />
        <Stat label="Lifetime orders" value={formatNumber(company.lifetimeOrders)} subtext={`${company.personalCadenceDays ?? "—"}d cadence`} />
        <Stat
          label="Days since last order"
          value={`${company.daysSinceLastOrder}d`}
          subtext={
            <span className="inline-flex items-center gap-1">
              vs predicted: <LapseBadge ratio={company.lapseRatio} />
            </span>
          }
        />
        <Stat
          label="Health"
          value={`${company.healthScore}`}
          subtext={<HealthBadge band={company.healthBand} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composite signals</CardTitle>
            <CardDescription>What's driving the health score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Signal
              label="Order velocity"
              good={velocityChange >= -10}
              detail={
                velocityChange > 5 ? `+${velocityChange.toFixed(0)}% L90d vs prior` :
                velocityChange < -10 ? `${velocityChange.toFixed(0)}% L90d vs prior — basket shrinking` :
                `Steady (${velocityChange.toFixed(0)}% L90d vs prior)`
              }
            />
            <Signal
              label="Cadence"
              good={company.lapseRatio < 1.0}
              detail={
                company.lapseRatio < 1.0
                  ? `On cadence (${company.lapseRatio.toFixed(2)}× of typical ${company.personalCadenceDays ?? "?"}d)`
                  : `${company.lapseRatio.toFixed(2)}× past typical reorder rhythm`
              }
            />
            <Signal
              label="Engagement"
              good={company.daysSinceLastEngagement < 21}
              detail={`${company.daysSinceLastEngagement}d since last touch · ${company.emailOpensL60d} email opens L60d`}
            />
            <Signal
              label="Contact base"
              good={company.activeContacts >= 2}
              detail={`${company.activeContacts} active contact${company.activeContacts === 1 ? "" : "s"}`}
            />
            <Signal
              label="Buyer intent"
              good={company.buyerIntentActive}
              detail={company.buyerIntentActive ? "Active on website L7d" : "No recent website activity"}
              positive={company.buyerIntentActive}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Order history</CardTitle>
            <CardDescription>Monthly revenue, full account lifetime ({orders.length} orders shown).</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.length > 1 ? (
              <LineSeriesChart
                data={monthly.map((m) => ({ month: m.month, revenue: m.revenue }))}
                xKey="month"
                series={[{ key: "revenue", label: "Revenue", color: "#F7941D" }]}
                yFormatter={(v) => formatCurrency(v, company.region)}
                height={220}
                showLegend={false}
              />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">Not enough order history to chart.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What they buy</CardTitle>
            <CardDescription>Top SKUs by lifetime spend.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSpendSkus.map((row) => (
                  <TableRow key={row.sku.code}>
                    <TableCell>
                      <div className="text-sm">{row.sku.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{row.sku.code}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(row.qty)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrencyExact(row.spend, company.region)}</TableCell>
                  </TableRow>
                ))}
                {topSpendSkus.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No order history yet.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Whitespace SKUs</CardTitle>
            <CardDescription>Peers buy these; this account doesn't.</CardDescription>
          </CardHeader>
          <CardContent>
            {company.top3CrossSellSkus.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No cross-sell candidates.</div>
            ) : (
              <ul className="space-y-2">
                {company.top3CrossSellSkus.map((code) => (
                  <li key={code} className="text-sm">
                    <div className="font-mono text-[11px] text-muted-foreground">{code}</div>
                    <div>{code}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Predicted next order</CardTitle>
            <CardDescription>Based on personal cadence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-sm border p-3">
              <div className="gtse-eyebrow text-muted-foreground">Predicted date</div>
              <div className="text-xl font-semibold">{formatDate(company.predictedNextOrderDate)}</div>
            </div>
            <div className="rounded-sm border p-3">
              <div className="gtse-eyebrow text-muted-foreground">Top reorder SKUs</div>
              <ul className="mt-1 space-y-1 text-sm">
                {company.top3ReorderSkus.map((code) => (
                  <li key={code} className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-[11px] text-muted-foreground">{code}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
            <Meta icon={Building2} label="Account owner / AE" value={company.ownerName} />
            <Meta icon={MapPin} label="Region" value={`${company.region_subdiv}, ${company.region}`} />
            <Meta icon={Mail} label="Last email engagement" value={`${formatDate(company.lastEngagementDate)} · ${company.emailOpensL60d} opens L60d`} />
            <Meta icon={Phone} label="Active contacts" value={`${company.activeContacts}`} />
            <Meta icon={RefreshCw} label="First order" value={formatDate(company.firstOrderDate)} />
            <Meta icon={RefreshCw} label="Last order" value={formatDate(company.lastOrderDate)} />
            <Meta icon={AlertTriangle} label="RFM segment" value={`${company.rfmSegment} (R${company.rfmScores.r} F${company.rfmScores.f} M${company.rfmScores.m})`} />
            <Meta icon={Sparkles} label="Buyer intent" value={company.buyerIntentActive ? "Active L7d" : "—"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
          <CardDescription>Most recent first. Showing {Math.min(reversedOrders.length, 25)} of {orders.length} orders.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reversedOrders.slice(0, 25).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm">{formatDate(o.date)}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{o.id}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      {o.lineItems.slice(0, 3).map((line, i) => (
                        <div key={i}>
                          <span className="text-muted-foreground">{line.qty}× </span>
                          <span>{line.skuName}</span>
                          <span className="text-muted-foreground"> ({formatCurrencyExact(line.lineTotal, company.region)})</span>
                        </div>
                      ))}
                      {o.lineItems.length > 3 ? (
                        <div className="text-[11px] italic text-muted-foreground">+ {o.lineItems.length - 3} more lines</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrencyExact(o.total, company.region)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No order history.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function Stat({ label, value, accent, subtext }: { label: string; value: string; accent?: boolean; subtext?: React.ReactNode }) {
  return (
    <div className="rounded-sm border bg-card p-3">
      <div className="gtse-eyebrow text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tracking-tight ${accent ? "text-gtse-orange" : ""}`}>{value}</div>
      {subtext ? <div className="mt-1 text-xs text-muted-foreground">{subtext}</div> : null}
    </div>
  );
}

function Signal({ label, good, detail, positive }: { label: string; good: boolean; detail: string; positive?: boolean }) {
  const dot = good
    ? "bg-emerald-500"
    : positive === true
      ? "bg-muted-foreground"
      : "bg-amber-500";
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

function Meta({
  icon: Icon, label, value,
}: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <div className="gtse-eyebrow text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}
