"use client";

import React from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

const labelStyle = { fontSize: 10, fontWeight: 600, fill: "currentColor" } as const;

function formatBarLabel(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "";
}

export function BarChartMini({
  data,
  horizontal = true,
  height = 56,
  showLabels = false,
}: {
  data: ChartSeriesPoint[];
  horizontal?: boolean;
  height?: number;
  showLabels?: boolean;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const chartData = filtered.map((d, i) => ({
    label: d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label,
    value: d.value,
    fill: d.color ?? colorAt(i),
  }));

  if (horizontal) {
    const maxLabelLen = Math.max(...chartData.map((d) => d.label.length), 4);
    const yAxisWidth = Math.min(80, Math.max(48, maxLabelLen * 5.5));

    return (
      <div className="w-full overflow-hidden text-gray-600 dark:text-gray-300" style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: showLabels ? 40 : 4, bottom: 0, left: 2 }}
            barSize={Math.max(5, Math.min(9, height / chartData.length - 2))}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              tick={{ fontSize: 10, fill: "currentColor" }}
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
              {showLabels ? (
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={formatBarLabel}
                  className="text-gray-600 dark:text-gray-300"
                  style={labelStyle}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden text-gray-600 dark:text-gray-300" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: showLabels ? 16 : 4, right: 4, bottom: 0, left: 4 }}>
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
            {showLabels ? (
              <LabelList
                dataKey="value"
                position="top"
                formatter={formatBarLabel}
                style={labelStyle}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Keep named export used by sections
export { BarChartMini as Bar };
