"use client";

import React from "react";
import { motion } from "motion/react";
import { Maximize2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import {
  ccAccent,
  ccCard,
  ccCardPremium,
  ccCardSub,
  ccCardTitle,
  ccCardValueLg,
  ccCardValueSm,
} from "./theme";

export type MasonrySize = "sm" | "md" | "lg" | "full";

const chartHeights: Record<MasonrySize, string> = {
  sm: "h-[100px]",
  md: "h-[150px]",
  lg: "h-[220px]",
  full: "h-[140px]",
};

const masonrySpan: Record<MasonrySize, string> = {
  sm: "",
  md: "",
  lg: "",
  full: "[column-span:all]",
};

export type AnalyticsCardProps = {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: keyof typeof ccAccent;
  primaryValue: number | string;
  secondaryLabel?: string;
  trend?: { value: string; positive: boolean };
  chart?: React.ReactNode;
  chartFill?: boolean;
  colSpan?: string;
  masonrySize?: MasonrySize;
  delay?: number;
  compact?: boolean;
  variant?: "default" | "premium";
  onExpand: (id: string) => void;
};

export function AnalyticsCard({
  id,
  title,
  icon: Icon,
  accent,
  primaryValue,
  secondaryLabel,
  trend,
  chart,
  masonrySize = "md",
  delay = 0,
  compact = false,
  variant = "default",
  onExpand,
}: AnalyticsCardProps) {
  const styles = ccAccent[accent];
  const numericValue = typeof primaryValue === "number" ? primaryValue : null;
  const animated = useAnimatedNumber(numericValue ?? 0);
  const displayValue =
    numericValue !== null ? animated.toLocaleString() : primaryValue;
  const size = compact ? "sm" : masonrySize;
  const isPremium = variant === "premium" && !compact;

  if (isPremium) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => onExpand(id)}
        aria-label={`Open ${title} details`}
        className={`group flex h-full w-full cursor-pointer flex-col overflow-hidden text-left ${ccCardPremium} ${styles.cardPremium} ${masonrySpan[size]} p-5`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${styles.iconBg} ${styles.icon}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="truncate text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {title}
            </span>
          </div>
          <Maximize2 className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-slate-500" />
        </div>

        <div className="mt-3 flex shrink-0 items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {displayValue}
          </span>
          {trend ? (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}
            </span>
          ) : null}
        </div>

        {secondaryLabel ? (
          <p className="mt-1 line-clamp-2 shrink-0 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {secondaryLabel}
          </p>
        ) : null}

        {chart ? (
          <div
            className={`pointer-events-none min-w-0 overflow-hidden border-t pt-4 ${styles.chartDivider} ${chartHeights[size]}`}
          >
            {chart}
          </div>
        ) : null}
      </motion.button>
    );
  }

  const valueClass = compact ? ccCardValueSm : ccCardValueLg;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={{ scale: 1.005 }}
      onClick={() => onExpand(id)}
      aria-label={`Open ${title} details`}
      className={`group flex h-full w-full cursor-pointer flex-col overflow-hidden text-left transition-shadow hover:shadow-lg ${ccCard} ${styles.border} ${styles.cardDefault} ${styles.glow} ${masonrySpan[size]} ${compact ? "p-2" : "p-2.5"}`}
    >
      <div className="mb-1 flex shrink-0 items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${styles.icon}`} />
        <span className={`min-w-0 flex-1 truncate ${ccCardTitle}`}>{title}</span>
        <span className={`shrink-0 tabular-nums ${valueClass}`}>{displayValue}</span>
        {trend ? (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium ${
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </span>
        ) : null}
        <Maximize2 className="h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500" />
      </div>

      {secondaryLabel ? (
        <p className={`mb-1 line-clamp-1 shrink-0 text-[10px] ${ccCardSub}`}>{secondaryLabel}</p>
      ) : null}

      {chart ? (
        <div
          className={`pointer-events-none min-w-0 overflow-hidden border-t pt-1.5 ${styles.chartDivider} ${chartHeights[size]}`}
        >
          {chart}
        </div>
      ) : null}
    </motion.button>
  );
}
