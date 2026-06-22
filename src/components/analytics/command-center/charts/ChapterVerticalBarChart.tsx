"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useAnimationReplay } from "../animation/AnimationReplayContext";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

export type ChapterBarPoint = ChartSeriesPoint & { fullName?: string };

type InsideLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
};

function chapterAxisLabel(name: string): string {
  const base = name.replace(/\s+chapter$/i, "").trim();
  if (base.length <= 14) return base;
  const segment = base.split(/\s+[&-]\s+/)[0]?.trim() ?? base;
  return segment.length <= 14 ? segment : `${segment.slice(0, 12)}…`;
}

function ValueLabel({ x = 0, y = 0, width = 0, height = 0, value }: InsideLabelProps) {
  const barX = Number(x);
  const barY = Number(y);
  const barW = Number(width);
  const barH = Number(height);
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(barH) || barH < 2 || !Number.isFinite(count)) return null;

  const cx = barX + barW / 2;
  const inside = barH >= 28;

  return (
    <text
      x={cx}
      y={inside ? barY + 18 : barY - 8}
      textAnchor="middle"
      fill={inside ? "#ffffff" : "#334155"}
      fontSize={12}
      fontWeight={700}
      style={inside ? { textShadow: "0 1px 2px rgba(0,0,0,0.35)" } : undefined}
    >
      {count.toLocaleString()}
    </text>
  );
}

export function ChapterVerticalBarChart({
  data,
  accent = "violet",
  height = 320,
  valueLabel = "Alumni",
}: {
  data: ChapterBarPoint[];
  accent?: "violet" | "emerald";
  height?: number;
  valueLabel?: string;
}) {
  const reduced = useReducedMotion();
  const { replayKey } = useAnimationReplay();

  const chartData = useMemo(
    () =>
      data
        .filter((d) => d.value > 0)
        .map((d, i) => {
          const fullName = d.fullName ?? d.label;
          return {
            ...d,
            fullName,
            axisLabel: chapterAxisLabel(fullName),
            value: d.value,
            fill: d.color ?? colorAt(i),
          };
        }),
    [data]
  );

  if (!chartData.length) return <ChartEmpty height={height} />;

  const gradientId = `chapter-bar-${accent}`;
  const gradient =
    accent === "emerald"
      ? { from: "#059669", to: "#34d399" }
      : { from: "#7c3aed", to: "#a78bfa" };

  const tickColor = accent === "emerald" ? "#047857" : "#6d28d9";

  return (
    <div className="w-full overflow-hidden rounded-lg bg-white/50 p-1 dark:bg-gray-900/20" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} key={`chapter-v-${accent}-${replayKey}`}>
        <BarChart
          data={chartData}
          margin={{ top: 28, right: 16, bottom: 72, left: 8 }}
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200/80 dark:stroke-slate-700/60" />
          <XAxis
            dataKey="axisLabel"
            interval={0}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fontWeight: 600, fill: tickColor }}
            angle={-32}
            textAnchor="end"
            height={72}
          />
          <YAxis
            scale="sqrt"
            domain={[0, "dataMax"]}
            width={42}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.15)" }}
            contentStyle={{ fontSize: 12, borderRadius: 10 }}
            labelFormatter={(_label, payload) =>
              (payload?.[0]?.payload as ChapterBarPoint | undefined)?.fullName ?? _label
            }
            formatter={(value: number) => [value.toLocaleString(), valueLabel]}
          />
          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            maxBarSize={48}
            minPointSize={6}
            isAnimationActive={!reduced}
            animationDuration={CHART.bar.duration}
            animationEasing={CHART.bar.easing}
          >
            {chartData.map((entry, i) => (
              <Cell key={`${entry.axisLabel}-${i}`} fill={entry.color ? entry.color : `url(#${gradientId})`} />
            ))}
            <LabelList dataKey="value" content={(props) => <ValueLabel {...(props as InsideLabelProps)} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
