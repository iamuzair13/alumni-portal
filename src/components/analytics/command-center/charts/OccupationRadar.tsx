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

type SnapshotRow = {
  subject: string;
  fullName: string;
  count: number;
  sharePct: number;
};

type VertexPayload = SnapshotRow;

function SnapshotVertexLabel(props: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: VertexPayload;
  value?: number;
  index?: number;
  compact?: boolean;
}) {
  const { x, y, cx, cy, payload, value, compact = false } = props;
  const share = payload?.sharePct ?? value;
  if (x == null || y == null || share == null || share <= 0) return null;

  const centerX = cx ?? x;
  const centerY = cy ?? y;
  const angle = Math.atan2(y - centerY, x - centerX);
  const offset = compact ? 11 : 14;
  const lx = x + Math.cos(angle) * offset;
  const ly = y + Math.sin(angle) * offset;
  const fontSize = compact ? 8 : 10;

  return (
    <text
      x={lx}
      y={ly}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontWeight={700}
      className="fill-emerald-700 dark:fill-emerald-300"
    >
      {`${share < 10 ? share.toFixed(1) : Math.round(share)}%`}
    </text>
  );
}

function makeSnapshotLabel(compact: boolean) {
  return (props: Parameters<typeof SnapshotVertexLabel>[0]) => (
    <SnapshotVertexLabel {...props} compact={compact} />
  );
}

/** Occupation snapshot radar — share % profile (0–100) with vertex data labels. */
export function OccupationRadar({
  data,
  height = 120,
}: {
  data: ChartSeriesPoint[];
  height?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const total = filtered.reduce((sum, d) => sum + d.value, 0);
  const chartData: SnapshotRow[] = filtered.map((d) => ({
    subject: shortLabel(d.label),
    fullName: d.label,
    count: d.value,
    sharePct: total > 0 ? (d.value / total) * 100 : 0,
  }));

  const compact = height < 160;
  const outerRadius = height >= 200 ? "68%" : height >= 150 ? "62%" : "56%";
  const tickSize = compact ? 9 : 10;
  const showRadiusTicks = height >= 130;

  return (
    <div className="h-full w-full overflow-hidden" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={outerRadius}>
          <PolarGrid
            gridType="polygon"
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
            domain={[0, 100]}
            tick={
              showRadiusTicks
                ? { fontSize: compact ? 7 : 8, fill: "#9ca3af" }
                : false
            }
            axisLine={false}
          />
          <RadarSeries
            name="Share"
            dataKey="sharePct"
            stroke="#059669"
            fill="#10b981"
            fillOpacity={0.45}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{
              r: compact ? 3 : 4,
              fill: "#059669",
              stroke: "#ffffff",
              strokeWidth: 1.5,
            }}
            activeDot={{
              r: compact ? 4 : 5,
              fill: "#047857",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            label={makeSnapshotLabel(compact)}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(_value: number, _name, item) => {
              const row = item?.payload as VertexPayload | undefined;
              if (!row) return ["—", ""];
              return [
                `${row.count.toLocaleString()} (${row.sharePct.toFixed(1)}%)`,
                row.fullName,
              ];
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
