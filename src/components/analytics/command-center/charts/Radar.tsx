"use client";

import React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RadarSeries,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { CHART_PALETTE } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

export function Radar({ data, height = 56 }: { data: ChartSeriesPoint[]; height?: number }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const max = Math.max(...filtered.map((d) => d.value), 1);
  const chartData = filtered.map((d) => ({
    subject: d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label,
    fullName: d.label,
    value: d.value,
    fullMark: max * 1.15,
  }));

  const outerRadius = Math.max(28, Math.min(height * 0.4, height / 2 - 12));
  const showTicks = height >= 100;

  return (
    <div className="h-full w-full overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={outerRadius}>
          <PolarGrid className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
          <PolarAngleAxis
            dataKey="subject"
            tick={
              showTicks
                ? { fontSize: 10, fill: "currentColor" }
                : false
            }
            className="text-gray-500 dark:text-gray-400"
          />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <RadarSeries
            name="Value"
            dataKey="value"
            stroke={CHART_PALETTE[0]}
            fill={CHART_PALETTE[0]}
            fillOpacity={0.35}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(value: number, _n, item) => [
              value.toLocaleString(),
              (item?.payload as { fullName?: string })?.fullName ?? "",
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
