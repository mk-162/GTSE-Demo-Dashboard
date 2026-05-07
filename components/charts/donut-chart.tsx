"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Props = {
  data: { name: string; value: number; color: string }[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  centerLabel?: { value: string; sub?: string };
  tooltipFormatter?: (v: number) => string;
};

export function DonutChart({
  data, height = 220, innerRadius = 56, outerRadius = 80, showLegend = true, centerLabel, tooltipFormatter,
}: Props) {
  return (
    <div style={{ width: "100%", height }} className="relative">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={90}
            endAngle={-270}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => tooltipFormatter ? tooltipFormatter(value) : value} />
          {showLegend ? (
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="circle"
              iconSize={8}
              layout="vertical"
              verticalAlign="middle"
              align="right"
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
      {centerLabel ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-semibold">{centerLabel.value}</div>
          {centerLabel.sub ? (
            <div className="text-xs text-muted-foreground">{centerLabel.sub}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
