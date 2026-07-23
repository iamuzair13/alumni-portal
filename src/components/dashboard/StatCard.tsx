"use client";

import React, { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  STAT_COLOR_THEMES,
  type StatSemanticColor,
} from "./dashboard-stats-config";

function useAnimatedCounter(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = target;
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  if (data.length < 2) return null;

  return (
    <div className="h-8 w-full opacity-90" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={0.12}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type StatCardProps = {
  label: string;
  value: number;
  isLoading?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  icon: LucideIcon;
  color: StatSemanticColor;
  sparkline?: number[];
  trend?: { value: string; positive: boolean };
  badge?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
};

export function StatCard({
  label,
  value,
  isLoading = false,
  isSelected = false,
  onClick,
  icon: Icon,
  color,
  sparkline,
  trend,
  badge,
  children,
  "aria-label": ariaLabel,
}: StatCardProps) {
  const theme = STAT_COLOR_THEMES[color];
  const animated = useAnimatedCounter(isLoading ? 0 : value);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${label} (${value.toLocaleString()})`}
      role="tab"
      aria-selected={isSelected}
      aria-pressed={isSelected}
      className={`
        group relative flex min-h-[88px] w-full flex-col rounded-[20px] border px-3.5 py-3 text-left
        bg-white/70 backdrop-blur-md dark:bg-gray-900/60
        border-white/60 dark:border-gray-700/60
        shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)]
        transition-all duration-300 ease-out
        hover:-translate-y-0.5 hover:shadow-lg
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        ${isSelected ? `ring-2 ring-accent-500/20 ${theme.iconChip}` : ``}
      `}
    >
      <Icon
        className={`absolute right-3 top-3 h-5 w-5 opacity-40 ${theme.icon}`}
        strokeWidth={1.75}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2 pr-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {(trend || badge) && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  trend.positive
                    ? "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-rose-100/90 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                }`}
              >
                {trend.positive ? (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
                {trend.value}
              </span>
            )}
            {badge && !trend && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${theme.badge}`}>
                {badge}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-1 flex-col justify-between">
        {children ? (
          children
        ) : isLoading ? (
          <div
            className="mt-1 h-9 w-28 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80"
            aria-label="Loading count"
          />
        ) : (
          <p className="text-4xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {animated.toLocaleString()}
          </p>
        )}

        {sparkline && sparkline.length >= 2 && (
          <div className="mt-1.5">
            <MiniSparkline data={sparkline} color={theme.spark} />
          </div>
        )}
      </div>
    </button>
  );
}

export function UnderApprovalMetricContent({
  newCount,
  changeCount,
  isLoadingNew,
  isLoadingChange,
}: {
  newCount: number;
  changeCount: number;
  isLoadingNew: boolean;
  isLoadingChange: boolean;
}) {
  const animatedNew = useAnimatedCounter(isLoadingNew ? 0 : newCount);
  const animatedChange = useAnimatedCounter(isLoadingChange ? 0 : changeCount);

  if (isLoadingNew && isLoadingChange) {
    return (
      <div
        className="mt-1 h-9 w-40 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80"
        aria-label="Loading approval counts"
      />
    );
  }

  return (
    <p className="text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white sm:text-3xl">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/80 px-2 py-0.5 text-slate-900 shadow-sm dark:border-gray-600/60 dark:bg-white/[0.06] dark:text-white">
          {isLoadingNew ? (
            <span className="inline-flex h-6 w-8 items-center justify-center">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60" />
            </span>
          ) : (
            animatedNew.toLocaleString()
          )}
        </span>
        <span className="text-slate-400 dark:text-slate-500" aria-hidden>
          |
        </span>
        <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/80 px-2 py-0.5 text-slate-900 shadow-sm dark:border-gray-600/60 dark:bg-white/[0.06] dark:text-white">
          {isLoadingChange ? (
            <span className="inline-flex h-6 w-8 items-center justify-center">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60" />
            </span>
          ) : (
            animatedChange.toLocaleString()
          )}
        </span>
      </span>
    </p>
  );
}
