"use client";

import React from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

export function BarChartMini({
  data,
  horizontal = true,
  height = 56,
}: {
  data: ChartSeriesPoint[];
  horizontal?: boolean;
  height?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const chartData = filtered.map((d, i) => ({
    label: d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label,
    value: d.value,
    fill: d.color ?? colorAt(i),
  }));

  if (horizontal) {
    return (
      <div className="w-full overflow-hidden" style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 4, bottom: 0, left: 0 }}
            barSize={Math.max(6, Math.min(10, height / chartData.length - 2))}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={52}
              tick={{ fontSize: 9, fill: "currentColor" }}
              className="text-gray-500 dark:text-gray-400"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(value: number) => [value.toLocaleString(), ""]}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {chartData.map((entry, i) => (
                <Cell key={entry.label} fill={entry.fill ?? colorAt(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "currentColor" }}
            className="text-gray-500 dark:text-gray-400"
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {chartData.map((entry, i) => (
              <Cell key={entry.label} fill={entry.fill ?? colorAt(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Keep named export used by sections
export { BarChartMini as Bar };
