"use client";

import React from "react";
import { Maximize2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { AnimatedCard } from "./animation/AnimatedCard";
import { AnimatedNumber } from "./animation/AnimatedNumber";
import { EmptyStateIdle } from "./animation/EmptyStateIdle";
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
  emptyIdle?: boolean;
  onExpand: (id: string) => void;
};

function ValueDisplay({
  primaryValue,
  valueClass,
  emptyIdle,
}: {
  primaryValue: number | string;
  valueClass: string;
  emptyIdle?: boolean;
}) {
  if (typeof primaryValue === "number") {
    if (emptyIdle && primaryValue === 0) {
      return (
        <EmptyStateIdle className={valueClass}>
          <AnimatedNumber value={0} />
        </EmptyStateIdle>
      );
    }
    return <AnimatedNumber value={primaryValue} className={valueClass} />;
  }
  return <span className={`tabular-nums ${valueClass}`}>{primaryValue}</span>;
}

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
  emptyIdle = false,
  onExpand,
}: AnalyticsCardProps) {
  const styles = ccAccent[accent];
  const size = compact ? "sm" : masonrySize;
  const isPremium = variant === "premium" && !compact;

  if (isPremium) {
    return (
      <AnimatedCard
        delay={delay}
        onClick={() => onExpand(id)}
        aria-label={`Open ${title} details`}
        className={`group flex h-full w-full cursor-pointer flex-col overflow-hidden text-left transition-shadow hover:shadow-lg ${ccCardPremium} ${styles.cardPremium} ${masonrySpan[size]} p-6`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${styles.iconBg} ${styles.icon}`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-5 text-slate-900 dark:text-white">{title}</h3>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex shrink-0 whitespace-nowrap rounded-2xl bg-slate-50 px-3 py-1.5 text-3xl font-bold tracking-tight text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white">
              <ValueDisplay primaryValue={primaryValue} valueClass="" emptyIdle={emptyIdle} />
            </span>
            <Maximize2 className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-slate-500" />
          </div>
        </div>

        <div className="mt-3 flex shrink-0 items-baseline gap-2">
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
          <p className="mt-1 shrink-0 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {secondaryLabel}
          </p>
        ) : null}

        {chart ? (
          <div
            className={`pointer-events-none mt-4 min-w-0 overflow-hidden border-t pt-5 ${styles.chartDivider} ${chartHeights[size]}`}
          >
            {chart}
          </div>
        ) : null}
      </AnimatedCard>
    );
  }

  const valueClass = compact ? ccCardValueSm : ccCardValueLg;

  return (
    <AnimatedCard
      delay={delay}
      onClick={() => onExpand(id)}
      aria-label={`Open ${title} details`}
      className={`group flex h-full w-full cursor-pointer flex-col overflow-hidden text-left transition-shadow hover:shadow-lg ${ccCard} ${styles.border} ${styles.cardDefault} ${styles.glow} ${masonrySpan[size]} ${compact ? "p-2" : "p-2.5"}`}
    >
      <div className="mb-1 flex shrink-0 items-center gap-2 ">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${styles.icon}`} />
        <span className={`min-w-0 flex-1 truncate ${ccCardTitle}`}>{title}</span>
        <ValueDisplay primaryValue={primaryValue} valueClass={`shrink-0  ${valueClass}`} emptyIdle={emptyIdle} />
        {trend ? (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[10px]  font-medium  ${
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
        <p className={`mb-1 line-clamp-1 shrink-0 text-[10px]  ${ccCardSub}`}>{secondaryLabel}</p>
      ) : null}

      {chart ? (
        <div
          className={`pointer-events-none min-w-0 overflow-hidden border-t pt-1.5  ${styles.chartDivider} ${chartHeights[size]}`}
        >
          {chart}
        </div>
      ) : null}
    </AnimatedCard>
  );
}
