import { Badge } from "./ui/badge";
import type { HealthBand } from "@/lib/mock-data/companies";

export function HealthBadge({ band, score }: { band: HealthBand; score?: number }) {
  const variant = band === "green" ? "green" : band === "amber" ? "amber" : "red";
  const label = band === "green" ? "Green" : band === "amber" ? "Amber" : "Red";
  return (
    <Badge variant={variant}>
      {label}{score !== undefined ? ` · ${score}` : ""}
    </Badge>
  );
}

export function LapseBadge({ ratio }: { ratio: number }) {
  let band: "green" | "amber" | "red" = "green";
  if (ratio >= 2.0) band = "red";
  else if (ratio >= 1.0) band = "amber";
  const display = `${ratio.toFixed(2)}×`;
  return <Badge variant={band}>{display}</Badge>;
}
