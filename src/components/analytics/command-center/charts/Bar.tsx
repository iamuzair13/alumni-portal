"use client";

import React from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useAnimationReplay } from "../animation/AnimationReplayContext";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

const labelStyle = { fontSize: 12, fontWeight: 600, fill: "currentColor" } as const;

function formatBarLabel(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "";
}

type PctLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
};

function PctLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value,
  isHorizontal,
}: PctLabelProps & { isHorizontal: boolean }) {
  const barX = Number(x);
  const barY = Number(y);
  const barW = Number(width);
  const barH = Number(height);
  const pct = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(barX) || !Number.isFinite(barY) || !Number.isFinite(barW) || !Number.isFinite(barH)) {
    return null;
  }

  const label = Number.isFinite(pct) ? `${Math.round(pct)}%` : "";

  // Common text styling for visibility
  const halo = {
    stroke: "#ffffff",
    strokeWidth: 2.5,
    paintOrder: "stroke",
  } as const;

  if (isHorizontal) {
    const fitsInside = barW >= 34;
    const cx = fitsInside ? barX + barW - 6 : barX + barW + 6;
    const cy = barY + barH / 2;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor={fitsInside ? "end" : "start"}
        dominantBaseline="middle"
        fill={fitsInside ? "#ffffff" : "#334155"}
        fontSize={12}
        fontWeight={700}
        style={fitsInside ? { textShadow: "0 1px 2px rgba(0,0,0,0.45)" } : halo}
      >
        {label}
      </text>
    );
  }

  const fitsInside = barH >= 18;
  const cx = barX + barW / 2;
  const cy = fitsInside ? barY + 14 : barY - 7;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={fitsInside ? "#ffffff" : "#334155"}
      fontSize={12}
      fontWeight={700}
      style={fitsInside ? { textShadow: "0 1px 2px rgba(0,0,0,0.45)" } : halo}
    >
      {label}
    </text>
  );
}

export function BarChartMini({
  data,
  horizontal = true,
  height = 56,
  showLabels = false,
  showPercentages = false,
  variant = "default",
}: {
  data: ChartSeriesPoint[];
  horizontal?: boolean;
  height?: number;
  showLabels?: boolean;
  showPercentages?: boolean;
  variant?: "default" | "premium";
}) {
  const isPremium = variant === "premium";
  const gradientId = "cc-bar-violet-gradient";
  const reduced = useReducedMotion();
  const { replayKey } = useAnimationReplay();
  const animate = !reduced;
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const total = filtered.reduce((sum, d) => sum + d.value, 0);

  const chartData = filtered.map((d, i) => ({
    label: d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label,
    value: d.value,
    percentage: total > 0 ? Math.round((d.value / total) * 100) : 0,
    fill: d.color ?? colorAt(i),
    index: i,
  }));

  if (horizontal) {
    const maxLabelLen = Math.max(...chartData.map((d) => d.label.length), 4);
    const yAxisWidth = Math.min(80, Math.max(48, maxLabelLen * 5.5));

    return (
      <div className="w-full overflow-hidden text-slate-600 dark:text-slate-300" style={{ height }}>
        <ResponsiveContainer width="100%" height={height} key={`bar-h-${replayKey}`}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: showLabels ? 40 : 4, bottom: 0, left: 2 }}
            barSize={Math.max(isPremium ? 7 : 5, Math.min(isPremium ? 11 : 9, height / chartData.length - 2))}
          >
            {isPremium ? (
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            ) : null}
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-gray-500 dark:text-gray-400"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(value: number) => [value.toLocaleString(), ""]}
            />
            <Bar
              dataKey="value"
              radius={isPremium ? [0, 8, 8, 0] : [0, 3, 3, 0]}
              isAnimationActive={animate && isPremium}
              animationDuration={isPremium ? 700 : CHART.bar.duration}
              animationEasing={CHART.bar.easing}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.label}
                  fill={isPremium ? `url(#${gradientId})` : entry.fill ?? colorAt(i)}
                />
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
              {showPercentages ? (
                <LabelList
                  dataKey="percentage"
                  content={(props) => <PctLabel {...(props as PctLabelProps)} isHorizontal />}
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
      <ResponsiveContainer width="100%" height={height} key={`bar-v-${replayKey}`}>
        <BarChart data={chartData} margin={{ top: showLabels ? 20 : 4, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-gray-500 dark:text-gray-400"
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar
            dataKey="value"
            radius={[3, 3, 0, 0]}
            isAnimationActive={animate}
            animationDuration={CHART.bar.duration}
            animationEasing={CHART.bar.easing}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={entry.label}
                fill={entry.fill ?? colorAt(i)}
                // Recharts uses animationBegin on Bar; stagger via begin offset per cell index
              />
            ))}
            {showLabels ? (
              <LabelList
                dataKey="value"
                position="top"
                formatter={formatBarLabel}
                style={labelStyle}
              />
            ) : null}
            {showPercentages ? (
              <LabelList
                dataKey="percentage"
                content={(props) => <PctLabel {...(props as PctLabelProps)} isHorizontal={false} />}
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
