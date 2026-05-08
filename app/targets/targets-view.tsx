"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { Download, RotateCcw, Sparkles, Target as TargetIcon, Send, Search, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthBadge, LapseBadge } from "@/components/health-badge";
import { RangeSliderRow } from "@/components/range-slider-row";
import { MultiSelect } from "@/components/multi-select";
import { useRegion } from "@/components/region-context";
import {
  EMPTY_CRITERIA, TEMPLATES, type TargetCriteria, type Range,
} from "@/lib/criteria-types";
import { targetsUrl } from "@/lib/criteria-url";
import { companiesToCsv, downloadCsv } from "@/lib/csv";
import { INDUSTRIES, type Industry } from "@/lib/industries";
import type {
  Company, FieldRange, HealthBand, RfmSegment, SizeBand, Region,
} from "@/lib/data/contracts";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SIZE_BANDS: SizeBand[] = ["large", "mid", "small", "micro"];
const RFM_SEGMENTS: RfmSegment[] = ["Champion", "Loyal", "Promising", "AtRisk", "CannotLose", "Hibernating", "New"];
const HEALTH_BANDS: HealthBand[] = ["green", "amber", "red"];

const PAGE_SIZE = 50;

type SortKey =
  | "name" | "ownerName" | "industry" | "ltmRevenue" | "lifetimeRevenue"
  | "daysSinceLastOrder" | "lapseRatio" | "healthScore";

type Props = {
  region: Region;
  initialCriteria: TargetCriteria;
  initialResults: Company[];
  initialRanges: Record<string, FieldRange>;
  initialOwners: string[];
};

function criteriaToInternalUrl(criteria: TargetCriteria): string {
  // Reuse the targetsUrl encoder, just swap the path. Since EMPTY_CRITERIA
  // sets some defaults, encode the criteria directly.
  const tail = targetsUrl(criteria).replace(/^\/targets/, "");
  return `/api/internal/companies${tail || ""}`;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json() as Promise<{ total: number; companies: Company[] }>;
};

export default function TargetsPage({
  region: initialRegion,
  initialCriteria,
  initialResults,
  initialRanges,
  initialOwners,
}: Props) {
  return (
    <React.Suspense fallback={null}>
      <TargetsView
        initialRegion={initialRegion}
        initialCriteria={initialCriteria}
        initialResults={initialResults}
        initialRanges={initialRanges}
        initialOwners={initialOwners}
      />
    </React.Suspense>
  );
}

function TargetsView({
  initialRegion,
  initialCriteria,
  initialResults,
  initialRanges,
  initialOwners,
}: {
  initialRegion: Region;
  initialCriteria: TargetCriteria;
  initialResults: Company[];
  initialRanges: Record<string, FieldRange>;
  initialOwners: string[];
}) {
  const { region } = useRegion();
  const [criteria, setCriteria] = React.useState<TargetCriteria>(initialCriteria);

  // Sync criteria.region to the global region toggle. When the cookie-driven
  // region changes via router.refresh(), the server will re-render this page
  // with new initialResults/Ranges/Owners; we mirror that into criteria so
  // the SWR fetch matches.
  const lastRegionRef = React.useRef<Region>(initialRegion);
  React.useEffect(() => {
    if (region !== lastRegionRef.current) {
      lastRegionRef.current = region;
      setCriteria((c) => ({ ...c, region }));
      setSelected(new Set());
    }
  }, [region]);

  // SWR refetches on criteria change. Initial render uses server-provided
  // initialResults via fallbackData so first paint is instant.
  const swrKey = criteriaToInternalUrl(criteria);
  const initialKey = criteriaToInternalUrl(initialCriteria);
  const { data: swrData } = useSWR(
    swrKey,
    fetcher,
    {
      fallbackData: swrKey === initialKey
        ? { total: initialResults.length, companies: initialResults }
        : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const results = swrData?.companies ?? initialResults;
  const totalLtm = results.reduce((s, c) => s + c.ltmRevenue, 0);
  const totalLifetime = results.reduce((s, c) => s + c.lifetimeRevenue, 0);

  // Region-derived data (ranges + owners). When the region prop changes, the
  // server provides fresh ones via initialRanges/initialOwners.
  const ranges = initialRanges;
  const owners = initialOwners;

  // Sort + paginate
  const [sortKey, setSortKey] = React.useState<SortKey>("ltmRevenue");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const sorted = React.useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb)
          : Number(va ?? 0) - Number(vb ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [results, sortKey, sortDir]);

  const [page, setPage] = React.useState(0);
  React.useEffect(() => setPage(0), [criteria, sortKey, sortDir]);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function togglePage() {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
    setSelected(next);
  }
  function toggleAllMatching() {
    if (selected.size >= sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  }
  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function updateRange(key: keyof TargetCriteria, range: Range | undefined) {
    setCriteria((c) => ({ ...c, [key]: range }));
  }
  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setCriteria({ ...EMPTY_CRITERIA, region: criteria.region, ...t.criteria });
    setSelected(new Set());
  }
  function reset() {
    setCriteria({ ...EMPTY_CRITERIA, region: criteria.region });
    setSelected(new Set());
  }

  function clearCriterion(key: keyof TargetCriteria) {
    setCriteria((c) => {
      const next: TargetCriteria = { ...c };
      const empty = EMPTY_CRITERIA as Record<string, unknown>;
      const reset = empty[key as string];
      if (reset !== undefined) (next as Record<string, unknown>)[key as string] = reset;
      else delete (next as Record<string, unknown>)[key as string];
      return next;
    });
  }

  function onSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "ownerName" || k === "industry" ? "asc" : "desc"); }
  }

  function exportCsv(scope: "selected" | "all") {
    const rows = scope === "selected" ? sorted.filter((r) => selected.has(r.id)) : sorted;
    if (rows.length === 0) return;
    const csv = companiesToCsv(rows);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`whale-targets-${criteria.region.toLowerCase()}-${date}.csv`, csv);
  }

  const fmtCurrency = (n: number) => formatCurrency(n, region);
  const fmtCurrencyTight = (n: number) => {
    if (n >= 1_000_000) return `${region === "UK" ? "£" : "$"}${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${region === "UK" ? "£" : "$"}${(n / 1000).toFixed(0)}k`;
    return `${region === "UK" ? "£" : "$"}${Math.round(n).toLocaleString()}`;
  };

  return (
    <PageShell
      title="Target builder"
      subtitle="Define criteria, pull a list of accounts that match, export to CSV, and (Phase 2) push tags to HubSpot."
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-gtse-orange" /> Quick targets</CardTitle>
              <CardDescription>Click a template to load criteria. Edit the sliders to refine.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="gtse-tile rounded-sm border bg-background px-3 py-2 text-left"
                title={t.description}
              >
                <div className="text-sm font-semibold leading-tight">{t.name}</div>
                <div className="text-[11px] text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Region scope</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={criteria.region}
                onValueChange={(v) => setCriteria((c) => ({ ...c, region: v as TargetCriteria["region"] }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UK">🇬🇧 UK only</SelectItem>
                  <SelectItem value="US">🇺🇸 US only</SelectItem>
                  <SelectItem value="All">Both regions</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <div className="text-xs font-medium text-foreground/80">Search company name</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={criteria.nameContains ?? ""}
                    onChange={(e) => setCriteria((c) => ({ ...c, nameContains: e.target.value || undefined }))}
                    placeholder="e.g. Sheffield, Manchester"
                    className="h-9 w-full rounded-sm border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revenue ranges</CardTitle>
              <CardDescription className="text-xs">Drag the handles to bound the search.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <RangeSliderRow
                label="Lifetime revenue"
                bound={ranges.lifetimeRevenue}
                value={criteria.lifetimeRevenue}
                format={fmtCurrencyTight}
                onChange={(r) => updateRange("lifetimeRevenue", r)}
              />
              <RangeSliderRow
                label="LTM revenue"
                bound={ranges.ltmRevenue}
                value={criteria.ltmRevenue}
                format={fmtCurrencyTight}
                onChange={(r) => updateRange("ltmRevenue", r)}
              />
              <RangeSliderRow
                label="L90d revenue"
                bound={ranges.l90dRevenue}
                value={criteria.l90dRevenue}
                format={fmtCurrencyTight}
                onChange={(r) => updateRange("l90dRevenue", r)}
              />
              <RangeSliderRow
                label="Prior 90d revenue"
                bound={ranges.prior90dRevenue}
                value={criteria.prior90dRevenue}
                format={fmtCurrencyTight}
                onChange={(r) => updateRange("prior90dRevenue", r)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cadence & health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <RangeSliderRow
                label="Lapse ratio (× cadence)"
                bound={ranges.lapseRatio}
                value={criteria.lapseRatio}
                format={(n) => `${n.toFixed(2)}×`}
                onChange={(r) => updateRange("lapseRatio", r)}
              />
              <RangeSliderRow
                label="Days since last order"
                bound={ranges.daysSinceLastOrder}
                value={criteria.daysSinceLastOrder}
                format={(n) => `${Math.round(n)}d`}
                onChange={(r) => updateRange("daysSinceLastOrder", r)}
              />
              <RangeSliderRow
                label="Health score"
                bound={ranges.healthScore}
                value={criteria.healthScore}
                format={(n) => `${Math.round(n)}`}
                onChange={(r) => updateRange("healthScore", r)}
              />
              <RangeSliderRow
                label="Lifetime orders"
                bound={ranges.lifetimeOrders}
                value={criteria.lifetimeOrders}
                format={(n) => `${Math.round(n)}`}
                onChange={(r) => updateRange("lifetimeOrders", r)}
              />
              <RangeSliderRow
                label="Email opens (L60d)"
                bound={ranges.emailOpensL60d}
                value={criteria.emailOpensL60d}
                format={(n) => `${Math.round(n)}`}
                onChange={(r) => updateRange("emailOpensL60d", r)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MultiSelect
                label="Industry"
                options={INDUSTRIES}
                selected={criteria.industries}
                onChange={(v) => setCriteria((c) => ({ ...c, industries: v as Industry[] }))}
              />
              <MultiSelect
                label="Size band"
                options={SIZE_BANDS}
                selected={criteria.sizeBands}
                onChange={(v) => setCriteria((c) => ({ ...c, sizeBands: v as SizeBand[] }))}
              />
              <MultiSelect
                label="RFM segment"
                options={RFM_SEGMENTS}
                selected={criteria.rfmSegments}
                onChange={(v) => setCriteria((c) => ({ ...c, rfmSegments: v as RfmSegment[] }))}
              />
              <MultiSelect
                label="Health band"
                options={HEALTH_BANDS}
                selected={criteria.healthBands}
                onChange={(v) => setCriteria((c) => ({ ...c, healthBands: v as HealthBand[] }))}
              />
              <MultiSelect
                label="Owner / AE"
                options={owners}
                selected={criteria.owners}
                onChange={(v) => setCriteria((c) => ({ ...c, owners: v }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <FlagRow
                label="Whale (top 50)"
                value={criteria.whaleFlag}
                onChange={(v) => setCriteria((c) => ({ ...c, whaleFlag: v }))}
              />
              <FlagRow
                label="Buyer intent active"
                value={criteria.buyerIntentActive}
                onChange={(v) => setCriteria((c) => ({ ...c, buyerIntentActive: v }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <ActiveFiltersBar criteria={criteria} onClear={(k) => clearCriterion(k)} />

          <div className="flex flex-wrap items-end justify-between gap-3 rounded-sm border bg-card p-4">
            <div className="flex flex-wrap items-end gap-6">
              <Stat label="Matching accounts" value={formatNumber(results.length)} accent />
              <Stat label="Total LTM revenue" value={fmtCurrency(totalLtm)} />
              <Stat label="Lifetime revenue" value={fmtCurrency(totalLifetime)} />
              <Stat label="Selected" value={formatNumber(selected.size)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => exportCsv("selected")}
              >
                <Download className="h-3.5 w-3.5" /> Export selected ({selected.size})
              </Button>
              <Button
                size="sm"
                disabled={results.length === 0}
                onClick={() => exportCsv("all")}
              >
                <Download className="h-3.5 w-3.5" /> Export all matching
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled
                title="Phase 2 — coming when HubSpot integration ships"
              >
                <Send className="h-3.5 w-3.5" /> Push to HubSpot
                <Badge variant="outline" className="ml-1 text-[10px]">Phase 2</Badge>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-muted/40 px-3 py-2 text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePage}
                className="flex items-center gap-2 rounded-sm border bg-background px-2 py-1 hover:bg-accent/30"
              >
                <Checkbox checked={allOnPageSelected} />
                <span>{allOnPageSelected ? "Unselect page" : "Select page"}</span>
              </button>
              <button
                onClick={toggleAllMatching}
                className="rounded-sm border bg-background px-2 py-1 hover:bg-accent/30"
              >
                {selected.size >= sorted.length && sorted.length > 0 ? "Unselect all" : `Select all ${formatNumber(sorted.length)} matching`}
              </button>
              <span className="text-muted-foreground">{selected.size} selected</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>

          <Card>
            <CardContent className="px-0 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-9"></TableHead>
                    <SortableHead field="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Company</SortableHead>
                    <SortableHead field="industry" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Industry</SortableHead>
                    <SortableHead field="ownerName" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Owner</SortableHead>
                    <SortableHead field="lifetimeRevenue" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Lifetime</SortableHead>
                    <SortableHead field="ltmRevenue" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">LTM</SortableHead>
                    <SortableHead field="daysSinceLastOrder" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Days since</SortableHead>
                    <SortableHead field="lapseRatio" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Lapse</SortableHead>
                    <SortableHead field="healthScore" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Health</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <TargetIcon className="h-6 w-6 opacity-40" />
                          <span>No accounts match these criteria. Try widening the sliders or clearing some categories.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageRows.map((c) => {
                    const isSelected = selected.has(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        data-state={isSelected ? "selected" : undefined}
                        className={isSelected ? "bg-gtse-orange/10" : undefined}
                      >
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(c.id)} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/account/${c.id}`}
                            className="block hover:text-gtse-orange"
                          >
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.region} · {c.region_subdiv} · {c.sizeBand}
                              {c.whaleFlag ? <span className="ml-1 text-gtse-orange font-semibold">· whale</span> : null}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.industry}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.ownerName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.lifetimeRevenue, c.region)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(c.ltmRevenue, c.region)}</TableCell>
                        <TableCell className="text-right">{c.daysSinceLastOrder}d</TableCell>
                        <TableCell><LapseBadge ratio={c.lapseRatio} /></TableCell>
                        <TableCell><HealthBadge band={c.healthBand} score={c.healthScore} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

type FilterPill = { key: keyof TargetCriteria; label: string };

function ActiveFiltersBar({
  criteria, onClear,
}: { criteria: TargetCriteria; onClear: (k: keyof TargetCriteria) => void }) {
  const pills: FilterPill[] = [];

  if (criteria.industries.length) pills.push({ key: "industries", label: `Industry: ${criteria.industries.join(", ")}` });
  if (criteria.sizeBands.length) pills.push({ key: "sizeBands", label: `Size: ${criteria.sizeBands.join(", ")}` });
  if (criteria.rfmSegments.length) pills.push({ key: "rfmSegments", label: `RFM: ${criteria.rfmSegments.join(", ")}` });
  if (criteria.healthBands.length) pills.push({ key: "healthBands", label: `Health: ${criteria.healthBands.join(", ")}` });
  if (criteria.owners.length) pills.push({ key: "owners", label: `Owner: ${criteria.owners.join(", ")}` });
  if (criteria.whaleFlag !== undefined) pills.push({ key: "whaleFlag", label: `Whale: ${criteria.whaleFlag ? "yes" : "no"}` });
  if (criteria.buyerIntentActive !== undefined) pills.push({ key: "buyerIntentActive", label: `Buyer intent: ${criteria.buyerIntentActive ? "yes" : "no"}` });
  if (criteria.nameContains) pills.push({ key: "nameContains", label: `Name: "${criteria.nameContains}"` });
  if (criteria.rfmScoreR !== undefined) pills.push({ key: "rfmScoreR", label: `R = ${criteria.rfmScoreR}` });
  if (criteria.rfmScoreF !== undefined) pills.push({ key: "rfmScoreF", label: `F = ${criteria.rfmScoreF}` });

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

  const ranges: { key: keyof TargetCriteria; label: string }[] = [
    { key: "lifetimeRevenue", label: "Lifetime" },
    { key: "ltmRevenue", label: "LTM" },
    { key: "l90dRevenue", label: "L90d" },
    { key: "prior90dRevenue", label: "Prior90d" },
    { key: "daysSinceLastOrder", label: "Days since" },
    { key: "lapseRatio", label: "Lapse" },
    { key: "healthScore", label: "Health" },
    { key: "lifetimeOrders", label: "Lifetime orders" },
    { key: "personalCadenceDays", label: "Cadence" },
    { key: "emailOpensL60d", label: "Opens" },
  ];
  for (const r of ranges) {
    const v = criteria[r.key] as Range | undefined;
    if (!v) continue;
    pills.push({ key: r.key, label: `${r.label}: ${fmt(v.min)}–${fmt(v.max)}` });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-gtse-orange/30 bg-gtse-orange/5 px-3 py-2">
      <span className="gtse-eyebrow text-gtse-orange">Active filters</span>
      {pills.map((p) => (
        <button
          key={String(p.key) + p.label}
          onClick={() => onClear(p.key)}
          className="inline-flex items-center gap-1 rounded-sm border bg-background px-2 py-0.5 text-xs hover:bg-accent"
          title="Click to clear"
        >
          {p.label}
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="gtse-eyebrow text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tracking-tight ${accent ? "text-gtse-orange" : ""}`}>{value}</div>
    </div>
  );
}

function FlagRow({
  label, value, onChange,
}: { label: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <div className="inline-flex rounded-sm border p-0.5 text-xs">
        <button
          onClick={() => onChange(value === true ? undefined : true)}
          className={`rounded-[2px] px-2 py-0.5 ${value === true ? "bg-gtse-orange text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(value === false ? undefined : false)}
          className={`rounded-[2px] px-2 py-0.5 ${value === false ? "bg-gtse-teal text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          No
        </button>
        <button
          onClick={() => onChange(undefined)}
          className={`rounded-[2px] px-2 py-0.5 ${value === undefined ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Any
        </button>
      </div>
    </div>
  );
}

function SortableHead({
  field, sortKey, sortDir, onSort, children, align,
}: {
  field: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  align?: "right";
}) {
  const active = sortKey === field;
  return (
    <TableHead
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none ${align === "right" ? "text-right" : ""}`}
    >
      {children}
      {active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </TableHead>
  );
}
