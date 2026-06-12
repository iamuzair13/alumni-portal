"use client";

import React, { useMemo } from "react";
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

/** Fixed pentagon axes — always 5 spokes like the reference radar. */
const OCCUPATION_AXES = [
  { label: "Employed", short: "Employed" },
  { label: "Self-employed", short: "Self-emp." },
  { label: "Unemployed (searching)", short: "Searching" },
  { label: "Unemployed (by choice)", short: "By choice" },
  { label: "Other", short: "Other" },
] as const;

const AXIS_COUNT = OCCUPATION_AXES.length;
const RADAR_STROKE = "#f59e0b";
const RADAR_FILL = "#f59e0b";
const GRID_STROKE = "#e2e8f0";
const AXIS_LABEL = "#64748b";
const DATA_LABEL = "#b45309";

type RadarRow = {
  subject: string;
  fullName: string;
  count: number;
  sharePct: number;
  plot: number;
};

function formatCountLabel(count: number): string {
  if (count >= 10_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toLocaleString();
}

function axisAngleRad(index: number): number {
  const deg = -90 + index * (360 / AXIS_COUNT);
  return (deg * Math.PI) / 180;
}

function getLabelPosition(
  px: number,
  py: number,
  angle: number,
  index: number,
  compact: boolean
): { x: number; y: number; anchor: "middle" | "start" | "end"; baseline: "middle" | "hanging" | "auto" } {
  const outward = compact ? 11 : 13;
  const inward = compact ? 14 : 16;

  // Top spoke (Employed): axis label sits above — place count inside the chart.
  if (index === 0) {
    return {
      x: px,
      y: py + inward,
      anchor: "middle",
      baseline: "hanging",
    };
  }

  // Bottom spokes: nudge count inward to avoid outer axis labels.
  if (index === 2 || index === 3) {
    return {
      x: px - Math.cos(angle) * inward * 0.65,
      y: py - Math.sin(angle) * inward * 0.65,
      anchor: "middle",
      baseline: "middle",
    };
  }

  return {
    x: px + Math.cos(angle) * outward,
    y: py + Math.sin(angle) * outward,
    anchor: index === 1 ? "start" : index === 4 ? "end" : "middle",
    baseline: "middle",
  };
}

function VertexDataLabel({
  x,
  y,
  cx = 0,
  cy = 0,
  index = 0,
  row,
  compact = false,
}: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  index?: number;
  row?: RadarRow;
  compact?: boolean;
}) {
  if (!row) return null;

  const angle = axisAngleRad(index);
  const atCenter =
    x == null ||
    y == null ||
    (Math.abs((x ?? 0) - cx) < 2 && Math.abs((y ?? 0) - cy) < 2);

  const px = atCenter ? cx + Math.cos(angle) * 12 : (x as number);
  const py = atCenter ? cy + Math.sin(angle) * 12 : (y as number);

  const { x: lx, y: ly, anchor, baseline } = getLabelPosition(px, py, angle, index, compact);

  return (
    <text
      x={lx}
      y={ly}
      textAnchor={anchor}
      dominantBaseline={baseline}
      fontSize={compact ? 8 : 9}
      fontWeight={700}
      fill={DATA_LABEL}
    >
      {formatCountLabel(row.count)}
    </text>
  );
}

function makeDataLabel(rows: RadarRow[], compact: boolean) {
  return (props: { x?: number; y?: number; cx?: number; cy?: number; index?: number }) => (
    <VertexDataLabel
      {...props}
      row={rows[props.index ?? 0]}
      compact={compact}
    />
  );
}

/** Occupation pentagon radar — amber polygon profile with vertex count labels. */
export function OccupationRadar({
  data,
  height = 120,
  showLabels = true,
}: {
  data: ChartSeriesPoint[];
  height?: number;
  showLabels?: boolean;
}) {
  const chartData = useMemo(() => {
    const byLabel = new Map(data.map((d) => [d.label, d.value]));
    const rows: RadarRow[] = OCCUPATION_AXES.map((axis) => {
      const count = byLabel.get(axis.label) ?? 0;
      return {
        subject: axis.short,
        fullName: axis.label,
        count,
        sharePct: 0,
        plot: 0,
      };
    });
    const total = rows.reduce((s, r) => s + r.count, 0);
    const maxCount = Math.max(...rows.map((r) => r.count), 1);
    return rows.map((r) => {
      const sharePct = total > 0 ? (r.count / total) * 100 : 0;
      return {
        ...r,
        sharePct,
        plot: maxCount > 0 ? (r.count / maxCount) * 100 : 0,
      };
    });
  }, [data]);

  const hasData = chartData.some((r) => r.count > 0);
  if (!hasData) return <ChartEmpty height={height} />;

  const compact = height < 160;
  const outerRadius = height >= 200 ? "68%" : height >= 150 ? "62%" : "54%";
  const tickSize = compact ? 8 : 9;
  const chartMargin = compact
    ? { top: 18, right: 26, bottom: 14, left: 26 }
    : { top: 20, right: 30, bottom: 16, left: 30 };

  return (
    <div className="h-full w-full bg-transparent " style={{ height }}>
      <ResponsiveContainer width="180%" height="180%" >
        <RadarChart
          data={chartData}
          cx="30%"
          cy="30%"
          outerRadius={outerRadius}
          margin={chartMargin}
        >
          <PolarGrid gridType="polygon" stroke={GRID_STROKE} strokeWidth={0.85} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: tickSize, fill: AXIS_LABEL, fontWeight: 500 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tickCount={6}
            tick={false}
            axisLine={false}
          />
          <RadarSeries
            name="Share"
            dataKey="plot"
            stroke={RADAR_STROKE}
            fill={RADAR_FILL}
            fillOpacity={0.42}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={{
              r: compact ? 3.5 : 4.5,
              fill: RADAR_STROKE,
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            activeDot={false}
            label={showLabels ? makeDataLabel(chartData, compact) : false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
            }}
            formatter={(_value: number, _name, item) => {
              const row = item?.payload as RadarRow | undefined;
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
