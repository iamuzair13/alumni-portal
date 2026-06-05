"use client";

import React from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { TrendBadge } from "./TrendBadge";

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  if (data.length < 2) return null;

  return (
    <div className="h-4 w-full opacity-80" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 1, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type KpiColor = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "orange" | "slate" | "blue";

const COLOR_MAP: Record<KpiColor, { spark: string; accent: string; label: string }> = {
  indigo: { spark: "#6366f1", accent: "border-l-indigo-500", label: "text-indigo-600 dark:text-indigo-400" },
  emerald: { spark: "#10b981", accent: "border-l-emerald-500", label: "text-emerald-600 dark:text-emerald-400" },
  amber: { spark: "#f59e0b", accent: "border-l-amber-500", label: "text-amber-600 dark:text-amber-400" },
  rose: { spark: "#f43f5e", accent: "border-l-rose-500", label: "text-rose-600 dark:text-rose-400" },
  sky: { spark: "#0ea5e9", accent: "border-l-sky-500", label: "text-sky-600 dark:text-sky-400" },
  violet: { spark: "#8b5cf6", accent: "border-l-violet-500", label: "text-violet-600 dark:text-violet-400" },
  orange: { spark: "#f97316", accent: "border-l-orange-500", label: "text-orange-600 dark:text-orange-400" },
  slate: { spark: "#64748b", accent: "border-l-slate-400", label: "text-slate-600 dark:text-slate-400" },
  blue: { spark: "#3b82f6", accent: "border-l-blue-500", label: "text-blue-600 dark:text-blue-400" },
};

export function SparklineKpiCard({
  title,
  value,
  subtitle,
  icon: _icon,
  color = "indigo",
  trend,
  sparkline,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: KpiColor;
  trend?: { value: string; positive: boolean };
  sparkline?: number[];
}) {
  const theme = COLOR_MAP[color];

  return (
    <div
      className={`group relative overflow-hidden rounded-md border border-gray-200/50 border-l-[3px] bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-sm transition-all hover:border-gray-300/60 hover:shadow dark:border-gray-800/80 dark:bg-gray-900/60 dark:hover:border-gray-700 ${theme.accent}`}
    >
      <p className={`truncate text-[9px] font-semibold uppercase tracking-widest ${theme.label}`}>{title}</p>

      <div className="mt-0.5 flex items-end justify-between gap-1">
        <p className="text-xl font-bold leading-none tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-2xl">
          {value}
        </p>
        {trend ? <TrendBadge value={trend.value} positive={trend.positive} compact /> : null}
      </div>

      {subtitle ? (
        <p className="mt-0.5 truncate text-[9px] leading-tight text-gray-400 dark:text-gray-500">{subtitle}</p>
      ) : null}

      {sparkline && sparkline.length >= 2 ? (
        <div className="mt-1 -mx-0.5">
          <MiniSparkline data={sparkline} color={theme.spark} />
        </div>
      ) : null}
    </div>
  );
}
