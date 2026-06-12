"use client";

import React, { useEffect, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useAnimationReplay } from "../animation/AnimationReplayContext";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function sliceLabel(minPercent: number) {
  return ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    value,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent?: number;
    value?: number;
  }) => {
    if (!percent || percent < minPercent || !value) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
}

export function Donut({
  data,
  size,
  showLabels = false,
  showLegend = false,
  minSlicePercent = 0.06,
}: {
  data: ChartSeriesPoint[];
  size?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  minSlicePercent?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState(size ?? 80);
  const reduced = useReducedMotion();
  const { replayKey } = useAnimationReplay();
  const animate = !reduced;

  useEffect(() => {
    if (size != null) {
      setDim(size);
      return;
    }
    const el = chartRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height: h } = el.getBoundingClientRect();
      const legendReserve = showLegend ? Math.min(72, pieDataLength(data) * 16) : 0;
      const availH = Math.max(48, h - legendReserve);
      const next = Math.floor(Math.min(width, availH) * 0.98);
      if (next > 0) setDim(Math.max(72, next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size, showLegend, data]);

  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={dim} />;

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const pieData = filtered.map((d, i) => ({
    name: d.label,
    value: d.value,
    fill: d.color ?? colorAt(i),
  }));

  const outerR = Math.max(22, dim / 2 - 2);
  const innerR = outerR * 0.45;

  const pieChart = (
    <ResponsiveContainer width="100%" height="100%" key={`donut-${replayKey}`}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerR}
          outerRadius={outerR}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={1.5}
          isAnimationActive={animate}
          animationDuration={CHART.donut.duration}
          animationEasing={CHART.donut.easing}
          label={showLabels ? sliceLabel(minSlicePercent) : false}
          labelLine={false}
        >
          {pieData.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={entry.fill ?? colorAt(i)}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
          formatter={(value: number, name: string) => [
            `${Number(value).toLocaleString()} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
            name,
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );

  if (size != null && !showLegend) {
    return (
      <div className="shrink-0" style={{ width: dim, height: dim }}>
        {pieChart}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <div
        ref={chartRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div className="shrink-0" style={{ width: dim, height: dim }}>
          {pieChart}
        </div>
      </div>

      {showLegend ? (
        <ul className="mt-1 shrink-0 space-y-1 px-0.5">
          {pieData.map((d) => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : "0";
            return (
              <li
                key={d.name}
                className="flex items-center gap-1.5 text-[10px] leading-tight text-gray-600 dark:text-gray-400"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: d.fill }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                <span className="shrink-0 tabular-nums font-semibold text-gray-800 dark:text-gray-200">
                  {formatCount(d.value)}
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums text-gray-500">{pct}%</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function pieDataLength(data: ChartSeriesPoint[]) {
  return data.filter((d) => d.value > 0).length;
}
