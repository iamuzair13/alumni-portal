"use client";

import React from "react";
import { motion } from "motion/react";
import { Maximize2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { ccAccent, ccCard, ccCardSub, ccCardTitle, ccCardValueLg } from "./theme";

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
  /** Place metrics and chart side-by-side (saves vertical space in tight cards) */
  splitBody?: boolean;
  colSpan?: string;
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
  splitBody,
  colSpan = "",
  delay = 0,
  compact = false,
  onExpand,
}: AnalyticsCardProps) {
  const styles = ccAccent[accent];
  const numericValue = typeof primaryValue === "number" ? primaryValue : null;
  const animated = useAnimatedNumber(numericValue ?? 0);
  const displayValue =
    numericValue !== null ? animated.toLocaleString() : primaryValue;
  const useSplit = splitBody ?? (compact && !!chart);

  const valueClass = compact
    ? "text-lg font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100"
    : ccCardValueLg;

  const metricsBlock = (
    <div className={useSplit ? "flex shrink-0 flex-col justify-center" : "shrink-0"}>
      <div className="flex items-baseline gap-2">
        <span className={valueClass}>{displayValue}</span>
        {trend ? (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </span>
        ) : null}
      </div>
      {secondaryLabel ? (
        <p className={`mt-0.5 line-clamp-2 ${compact ? "text-[10px] leading-tight" : ""} ${ccCardSub}`}>
          {secondaryLabel}
        </p>
      ) : null}
    </div>
  );

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={compact ? undefined : { scale: 1.01 }}
      onClick={() => onExpand(id)}
      className={`group flex h-full min-h-0 flex-col overflow-hidden text-left transition-shadow hover:shadow-lg ${ccCard} ${styles.border} ${styles.glow} ${colSpan} ${compact ? "p-2" : "p-2.5"}`}
    >
      <div className={`flex shrink-0 items-center gap-2 ${compact ? "mb-1" : "mb-1.5"}`}>
        <Icon className={`h-4 w-4 shrink-0 ${styles.icon}`} />
        <span className={`min-w-0 flex-1 truncate ${ccCardTitle}`}>{title}</span>
        <Maximize2 className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500" />
      </div>

      {useSplit ? (
        <div className="flex min-h-0 flex-1 items-stretch gap-2 overflow-hidden">
          {metricsBlock}
          {chart ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden">
              {chart}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
          {metricsBlock}
          {chart ? (
            <div
              className={`min-w-0 overflow-hidden ${
                chartFill ? "min-h-0 flex-1 pt-0.5" : "shrink-0 pt-1"
              }`}
            >
              {chart}
            </div>
          ) : null}
        </div>
      )}
    </motion.button>
  );
}
