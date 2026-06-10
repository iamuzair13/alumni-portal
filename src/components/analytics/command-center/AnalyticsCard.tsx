"use client";

import React from "react";
import { motion } from "motion/react";
import { Maximize2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { ccAccent, ccCard, ccCardSub, ccCardTitle, ccCardValueLg, ccCardValueSm } from "./theme";

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
  /** When true, chart expands to fill remaining card height */
  chartFill?: boolean;
  /** @deprecated use masonrySize — kept for gradual migration */
  colSpan?: string;
  masonrySize?: MasonrySize;
  delay?: number;
  compact?: boolean;
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
  chartFill = false,
  masonrySize = "md",
  delay = 0,
  compact = false,
  onExpand,
}: AnalyticsCardProps) {
  const styles = ccAccent[accent];
  const numericValue = typeof primaryValue === "number" ? primaryValue : null;
  const animated = useAnimatedNumber(numericValue ?? 0);
  const displayValue =
    numericValue !== null ? animated.toLocaleString() : primaryValue;
  const size = compact ? "sm" : masonrySize;
  const valueClass = compact ? ccCardValueSm : ccCardValueLg;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={{ scale: 1.005 }}
      onClick={() => onExpand(id)}
      className={`group flex h-full w-full flex-col overflow-hidden text-left transition-shadow hover:shadow-lg ${ccCard} ${styles.border} ${styles.glow} ${masonrySpan[size]} ${compact ? "p-2" : "p-2.5"}`}
    >
      <div className={`flex shrink-0 items-center gap-2 ${compact ? "mb-1" : "mb-1"}`}>
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
        <p className={`mb-1 line-clamp-1 shrink-0 ${compact ? "text-[10px] leading-tight" : "text-[10px]"} ${ccCardSub}`}>
          {secondaryLabel}
        </p>
      ) : null}

      {chart ? (
        <div className={`min-w-0 overflow-hidden ${chartHeights[size]}`}>
          {chart}
        </div>
      ) : null}
    </motion.button>
  );
}
