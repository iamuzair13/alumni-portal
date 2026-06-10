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

type VertexPayload = { count?: number; fullName?: string };

function VertexLabel(props: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: VertexPayload;
  value?: number;
}) {
  const { x, y, cx, cy, payload, value } = props;
  const count = payload?.count ?? value;
  if (x == null || y == null || count == null || count <= 0) return null;

  const centerX = cx ?? x;
  const centerY = cy ?? y;
  const angle = Math.atan2(y - centerY, x - centerX);
  const offset = 14;
  const lx = x + Math.cos(angle) * offset;
  const ly = y + Math.sin(angle) * offset;

  return (
    <text
      x={lx}
      y={ly}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={10}
      fontWeight={700}
      className="fill-emerald-700 dark:fill-emerald-300"
    >
      {formatCount(count)}
    </text>
  );
}

/** Occupation radar — area fill scaled to raw counts (not normalized %), with vertex data labels. */
export function OccupationRadar({
  data,
  height = 120,
}: {
  data: ChartSeriesPoint[];
  height?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const maxCount = Math.max(...filtered.map((d) => d.value), 1);
  const domainMax = Math.ceil(maxCount * 1.15);

  const chartData = filtered.map((d) => ({
    subject: shortLabel(d.label),
    fullName: d.label,
    count: d.value,
  }));

  const showRadiusTicks = height >= 160;
  const showVertexLabels = height >= 170;
  const outerRadius = height >= 200 ? "72%" : height >= 150 ? "65%" : "58%";
  const tickSize = height >= 180 ? 11 : 10;

  return (
    <div className="h-full w-full overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={outerRadius}>
          <PolarGrid
            gridType="circle"
            className="stroke-gray-200 dark:stroke-gray-600"
            strokeWidth={0.75}
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: tickSize, fill: "#6b7280", fontWeight: 500 }}
            className="dark:[&_text]:fill-gray-400"
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, domainMax]}
            tick={
              showRadiusTicks
                ? { fontSize: 8, fill: "#9ca3af" }
                : false
            }
            axisLine={false}
          />
          <RadarSeries
            name="Alumni"
            dataKey="count"
            stroke="#059669"
            fill="#10b981"
            fillOpacity={0.62}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{
              r: 4,
              fill: "#059669",
              stroke: "#ffffff",
              strokeWidth: 1.5,
            }}
            activeDot={{
              r: 5,
              fill: "#047857",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            label={showVertexLabels ? VertexLabel : false}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(_value: number, _name, item) => {
              const row = item?.payload as VertexPayload | undefined;
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
