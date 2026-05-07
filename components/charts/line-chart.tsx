"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Series = { key: string; label: string; color: string };
type Props<T extends Record<string, string | number>> = {
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  yFormatter?: (v: number) => string;
  height?: number;
  showLegend?: boolean;
};

export function LineSeriesChart<T extends Record<string, string | number>>({
  data, xKey, series, yFormatter, height = 240, showLegend = true,
}: Props<T>) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
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
          <Tooltip
            formatter={(value: number) => (yFormatter ? yFormatter(value) : value)}
            cursor={{ stroke: "hsl(var(--border))" }}
          />
          {showLegend ? (
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="circle"
              iconSize={8}
            />
          ) : null}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
