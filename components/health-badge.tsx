import { Badge } from "./ui/badge";
import type { HealthBand } from "@/lib/data/contracts";

export function HealthBadge({ band, score }: { band: HealthBand; score?: number }) {
  // 'unknown' is the neutral band for customers with no engagement data
  // — added 2026-05-13 to stop everyone defaulting to Green. See
  // fn_health_score in migration 015.
  const variant =
    band === "green" ? "green" :
    band === "amber" ? "amber" :
    band === "red" ? "red" :
    "muted";
  const label =
    band === "green" ? "Green" :
    band === "amber" ? "Amber" :
    band === "red" ? "Red" :
    "Unknown";
  const scoreSuffix =
    score !== undefined && score !== null ? ` · ${score}` : "";
  return (
    <Badge variant={variant}>
      {label}{scoreSuffix}
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
