"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  Cell,
} from "recharts";

type Series = { key: string; label: string; color: string };

type Props<T extends Record<string, string | number>> = {
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  layout?: "vertical" | "horizontal"; // vertical = bars rise vertically (default)
  yFormatter?: (v: number) => string;
  height?: number;
  showLegend?: boolean;
  stacked?: boolean;
  cellColors?: string[]; // optional per-row colours when single series
};

export function BarSeriesChart<T extends Record<string, string | number>>({
  data, xKey, series, yFormatter, height = 260, showLegend = true, stacked = false, layout = "vertical", cellColors,
}: Props<T>) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 10, right: 16, bottom: 0, left: 8 }}
          layout={layout === "horizontal" ? "vertical" : "horizontal"}
        >
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          {layout === "horizontal" ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={yFormatter}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                width={130}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={yFormatter}
              />
            </>
          )}
          <Tooltip
            formatter={(value: number) => (yFormatter ? yFormatter(value) : value)}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          />
          {showLegend ? (
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          ) : null}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              stackId={stacked ? "stack" : undefined}
              radius={[4, 4, 0, 0]}
            >
              {cellColors && series.length === 1
                ? data.map((_, idx) => <Cell key={idx} fill={cellColors[idx % cellColors.length]} />)
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
