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
import { ChartEmpty } from "./ChartEmpty";

const SHORT_LABELS: Record<string, string> = {
  Employed: "Employed",
  "Self-employed": "Self-emp.",
  "Unemployed (searching)": "Searching",
  "Unemployed (by choice)": "By choice",
  Other: "Other",
};

function shortLabel(label: string): string {
  return SHORT_LABELS[label] ?? (label.length > 11 ? `${label.slice(0, 10)}…` : label);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

type VertexPayload = { count?: number; fullName?: string; pct?: number };

function VertexLabel(props: { x?: number; y?: number; payload?: VertexPayload }) {
  const { x, y, payload } = props;
  const count = payload?.count;
  if (x == null || y == null || count == null || count <= 0) return null;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight={700}
      fill="#047857"
    >
      {formatCount(count)}
    </text>
  );
}

/** Occupation radar — normalized web shape, vertex dots, and count data labels. */
export function OccupationRadar({
  data,
  height = 120,
}: {
  data: ChartSeriesPoint[];
  height?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const max = Math.max(...filtered.map((d) => d.value), 1);
  const chartData = filtered.map((d) => ({
    subject: shortLabel(d.label),
    fullName: d.label,
    count: d.value,
    pct: Math.round((d.value / max) * 100),
  }));

  return (
    <div className="h-full w-full overflow-hidden [&_text]:dark:fill-emerald-300" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid
            gridType="polygon"
            className="stroke-gray-200 dark:stroke-gray-600"
            strokeWidth={0.75}
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <RadarSeries
            name="Alumni"
            dataKey="pct"
            stroke="#059669"
            fill="#10b981"
            fillOpacity={0.55}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={{
              r: 5,
              fill: "#10b981",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "#059669",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            label={VertexLabel}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(_pct: number, _name, item) => {
              const row = item?.payload as VertexPayload & { fullName?: string } | undefined;
              return [
                row?.count != null ? row.count.toLocaleString() : "—",
                row?.fullName ?? "Alumni",
              ];
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
