"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

const CATEGORY_COLORS: Record<string, string> = {
  dining: KPI_COLOR_HEX.amber,
  retail: KPI_COLOR_HEX.indigo,
  travel: KPI_COLOR_HEX.sky,
  health: KPI_COLOR_HEX.emerald,
  professional: KPI_COLOR_HEX.violet,
  financial: KPI_COLOR_HEX.rose,
};

const CATEGORY_SHORT: Record<string, string> = {
  dining: "Din",
  retail: "Ret",
  travel: "Trv",
  health: "Hlt",
  professional: "Pro",
  financial: "Fin",
};

type BarItem = {
  label: string;
  short: string;
  value: number;
  color: string;
};

function CategoryBarRow({
  bar,
  maxBar,
  isLeader,
  index,
  reduced,
}: {
  bar: BarItem;
  maxBar: number;
  isLeader: boolean;
  index: number;
  reduced: boolean;
}) {
  const width = bar.value === 0 ? 0 : Math.max(6, (bar.value / maxBar) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);

  return (
    <div
      className={`grid min-h-[1.25rem] grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-1 rounded-md px-0.5 ${
        isLeader && bar.value > 0 ? "bg-violet-50/60 dark:bg-violet-500/[0.06]" : ""
      }`}
      title={bar.label}
    >
      <span
        className="flex h-5 w-7 shrink-0 items-center justify-center rounded text-[9px] font-bold leading-none"
        style={{
          color: bar.color,
          background: `${bar.color}18`,
          boxShadow: `inset 0 0 0 1px ${bar.color}30`,
        }}
      >
        {bar.short}
      </span>

      <div className="relative h-1.5 min-w-0 overflow-hidden rounded-full bg-slate-100/90 dark:bg-slate-800/70">
        <motion.div
          initial={{ width: reduced ? `${width}%` : 0 }}
          animate={{ width: `${width}%` }}
          transition={{
            delay: reduced ? 0 : stagger,
            duration: reduced ? 0 : CHART.progress.duration,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${bar.color}, ${bar.color}aa)`,
          }}
        />
      </div>

      <span className="truncate text-right text-[10px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
        {bar.value.toLocaleString()}
      </span>
    </div>
  );
}

function buildFallbackBars(
  total: number,
  merchantCount: number,
  merchants: Array<{ merchant: string }>
): BarItem[] {
  const fallback: BarItem[] = [];

  if (total > 0) {
    fallback.push({
      label: "Applications",
      short: "App",
      value: total,
      color: KPI_COLOR_HEX.violet,
    });
  }

  if (merchants.length > 0) {
    const merchantColors = [KPI_COLOR_HEX.emerald, KPI_COLOR_HEX.sky, KPI_COLOR_HEX.amber, KPI_COLOR_HEX.indigo];
    merchants.slice(0, 3).forEach((m, i) => {
      const name = m.merchant.trim();
      if (!name) return;
      fallback.push({
        label: name,
        short: name.length > 3 ? name.slice(0, 3) : name,
        value: 1,
        color: merchantColors[i % merchantColors.length],
      });
    });
    if (merchantCount > merchants.slice(0, 3).length) {
      const remaining = merchantCount - Math.min(merchants.length, 3);
      if (remaining > 0) {
        fallback.push({
          label: "More partners",
          short: `+${remaining}`,
          value: remaining,
          color: KPI_COLOR_HEX.slate,
        });
      }
    }
  } else if (merchantCount > 0) {
    fallback.push({
      label: "Partners",
      short: "Ptr",
      value: merchantCount,
      color: KPI_COLOR_HEX.emerald,
    });
  }

  return fallback;
}

export function DiscountsMerchantsCardChart({
  categories,
  total,
  merchantCount,
  merchants = [],
}: {
  categories: Array<{ key: string; label: string; value: number }>;
  total: number;
  merchantCount: number;
  merchants?: Array<{ merchant: string; discount?: string; reference?: string }>;
}) {
  const reduced = useReducedMotion();

  const bars = useMemo(() => {
    const categoryBars = categories
      .filter((c) => c.value > 0)
      .map((c) => ({
        label: c.label,
        short: CATEGORY_SHORT[c.key] ?? c.label.slice(0, 3),
        value: c.value,
        color: CATEGORY_COLORS[c.key] ?? KPI_COLOR_HEX.slate,
      }));

    if (categoryBars.length > 0) return categoryBars;
    return buildFallbackBars(total, merchantCount, merchants);
  }, [categories, total, merchantCount, merchants]);

  if (bars.length === 0) {
    return <ChartEmpty height={100} variant="premium" message="No discounts or merchants yet" />;
  }

  const maxBar = Math.max(...bars.map((b) => b.value), 1);
  const topCategory = [...bars].sort((a, b) => b.value - a.value)[0];
  const shareDenominator = categories.some((c) => c.value > 0) ? total : bars.reduce((sum, b) => sum + b.value, 0);
  const topPct =
    shareDenominator > 0 && topCategory ? Math.round((topCategory.value / shareDenominator) * 100) : 0;
  const hasCategoryBreakdown = categories.some((c) => c.value > 0);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
        {bars.map((bar, i) => (
          <CategoryBarRow
            key={`${bar.label}-${i}`}
            bar={bar}
            maxBar={maxBar}
            isLeader={topCategory?.label === bar.label}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>

      {topCategory && topCategory.value > 0 ? (
        <p className="shrink-0 truncate text-center text-[11px] font-medium text-violet-600/90 dark:text-violet-400/90">
          {hasCategoryBreakdown ? (
            <>
              <span className="font-bold tabular-nums">{topPct}%</span>
              {" · "}
              {topCategory.label} leads
              {merchantCount > 0 ? ` · ${merchantCount.toLocaleString()} merchants` : ""}
            </>
          ) : merchantCount > 0 ? (
            <>
              {total.toLocaleString()} applications
              {" · "}
              {merchantCount.toLocaleString()} partner merchants
            </>
          ) : (
            <>
              <span className="font-bold tabular-nums">{topPct}%</span>
              {" · "}
              {topCategory.label}
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
