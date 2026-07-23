"use client";

import React, { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { Card } from "./Card";
import { MetricTrend } from "./MetricTrend";

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

function MiniSparkline({ data, color = "var(--color-accent-500)" }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  if (data.length < 2) return null;

  return (
    <div className="h-5 w-full opacity-60" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={color}
            fillOpacity={0.08}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface KpiCardProps {
  label: string;
  value: number;
  isLoading?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  sparkline?: number[];
  sparklineColor?: string;
  trend?: { value: string; positive: boolean };
  badge?: string;
  children?: React.ReactNode;
  accentBorder?: string;
  accentIconChip?: string;
  accentIconColor?: string;
  "aria-label"?: string;
}

export function KpiCard({
  label,
  value,
  isLoading = false,
  isSelected = false,
  onClick,
  icon: Icon,
  sparkline,
  sparklineColor,
  trend,
  badge,
  children,
  accentBorder,
  accentIconChip,
  accentIconColor,
  "aria-label": ariaLabel,
}: KpiCardProps) {
  const animated = useAnimatedCounter(isLoading ? 0 : value);

  const inner = (
    <>
      {Icon && (
        <div
          className={twMerge(
            "absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md",
            accentIconChip ?? "bg-gray-100 dark:bg-gray-800"
          )}
        >
          <Icon
            className={twMerge("h-3 w-3", accentIconColor ?? "text-gray-400 dark:text-gray-500")}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-1.5 pr-8">
        <p className="text-[10px] font-semibold uppercase leading-3 tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </p>
        {(trend || badge) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {trend && <MetricTrend value={trend.value} positive={trend.positive} />}
            {badge && !trend && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {badge}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-0.5 flex flex-1 flex-col justify-between">
        {children ? (
          children
        ) : isLoading ? (
          <div className="mt-1 h-8 w-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        ) : (
          <p className="text-2xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
            {animated.toLocaleString()}
          </p>
        )}

        {sparkline && sparkline.length >= 2 && (
          <div className="mt-1">
            <MiniSparkline data={sparkline} color={sparklineColor} />
          </div>
        )}
      </div>
    </>
  );

  const cardClassName = twMerge(
    "h-full min-h-[80px] border-l-[3px] p-3",
    accentBorder ?? "border-l-gray-200 dark:border-l-gray-700"
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        role="tab"
        aria-selected={isSelected}
        aria-label={ariaLabel ?? `${label} (${value.toLocaleString()})`}
        className={twMerge(
          "block h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/25 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        )}
      >
        <Card hover active={isSelected} size="md" className={cardClassName}>
          {inner}
        </Card>
      </button>
    );
  }

  return (
    <Card active={isSelected} size="md" className={cardClassName}>
      {inner}
    </Card>
  );
}
