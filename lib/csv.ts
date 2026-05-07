import type { Company } from "./mock-data/companies";

const COLUMNS: { key: keyof Company; label: string }[] = [
  { key: "id", label: "Company ID" },
  { key: "name", label: "Company name" },
  { key: "region", label: "Region" },
  { key: "industry", label: "Industry" },
  { key: "sizeBand", label: "Size band" },
  { key: "region_subdiv", label: "Region subdivision" },
  { key: "ownerName", label: "Owner / AE" },
  { key: "rfmSegment", label: "RFM segment" },
  { key: "healthScore", label: "Health score" },
  { key: "healthBand", label: "Health band" },
  { key: "whaleFlag", label: "Whale" },
  { key: "lifetimeOrders", label: "Lifetime orders" },
  { key: "lifetimeRevenue", label: "Lifetime revenue" },
  { key: "ltmRevenue", label: "LTM revenue" },
  { key: "l90dRevenue", label: "L90d revenue" },
  { key: "prior90dRevenue", label: "Prior 90d revenue" },
  { key: "personalCadenceDays", label: "Cadence (days)" },
  { key: "daysSinceLastOrder", label: "Days since last order" },
  { key: "lapseRatio", label: "Lapse ratio" },
  { key: "lastOrderDate", label: "Last order date" },
  { key: "predictedNextOrderDate", label: "Predicted next order" },
  { key: "buyerIntentActive", label: "Buyer intent" },
  { key: "lastEngagementDate", label: "Last engagement" },
  { key: "daysSinceLastEngagement", label: "Days since engagement" },
  { key: "emailOpensL60d", label: "Email opens L60d" },
  { key: "activeContacts", label: "Active contacts" },
];

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function companiesToCsv(rows: Company[]): string {
  const header = COLUMNS.map((c) => escape(c.label)).join(",");
  const lines = rows.map((r) =>
    COLUMNS.map((c) => escape(r[c.key])).join(","),
  );
  return [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
