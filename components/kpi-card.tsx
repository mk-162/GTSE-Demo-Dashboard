import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  trend?: { direction: "up" | "down" | "flat"; value: string; positiveIsGood?: boolean };
  caption?: string;
  className?: string;
};

export function KpiCard({ label, value, trend, caption, className }: Props) {
  const goodWhenUp = trend?.positiveIsGood ?? true;
  const goodMove =
    trend?.direction === "flat"
      ? "neutral"
      : (trend?.direction === "up") === goodWhenUp
        ? "good"
        : "bad";

  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-3xl font-semibold leading-none tracking-tight">{value}</div>
        <div className="flex items-center justify-between gap-2 text-xs">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                goodMove === "good" && "text-emerald-600 dark:text-emerald-400",
                goodMove === "bad" && "text-red-600 dark:text-red-400",
                goodMove === "neutral" && "text-muted-foreground",
              )}
            >
              {trend.direction === "up" && <ArrowUp className="h-3 w-3" />}
              {trend.direction === "down" && <ArrowDown className="h-3 w-3" />}
              {trend.direction === "flat" && <Minus className="h-3 w-3" />}
              {trend.value}
            </span>
          ) : (
            <span />
          )}
          {caption ? <span className="text-muted-foreground">{caption}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
