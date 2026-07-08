"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

const TIER_META = [
  { tier: "A+", color: KPI_COLOR_HEX.violet },
  { tier: "A", color: KPI_COLOR_HEX.sky },
  { tier: "B", color: KPI_COLOR_HEX.orange },
  { tier: "C", color: KPI_COLOR_HEX.slate },
  { tier: "D", color: KPI_COLOR_HEX.rose },
] as const;

function TierBarRow({
  bar,
  maxBar,
  isLeader,
  index,
  reduced,
}: {
  bar: { label: string; value: number; color: string };
  maxBar: number;
  isLeader: boolean;
  index: number;
  reduced: boolean;
}) {
  const width = bar.value === 0 ? 0 : Math.max(6, (bar.value / maxBar) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-[1.5rem_minmax(0,1fr)_1.75rem] items-center gap-1 rounded-md px-0.5 ${
        isLeader && bar.value > 0 ? "bg-emerald-50/60 dark:bg-emerald-500/[0.06]" : ""
      }`}
    >
      <span
        className="flex h-5 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold leading-none"
        style={{
          color: bar.color,
          background: `${bar.color}18`,
          boxShadow: `inset 0 0 0 1px ${bar.color}30`,
        }}
      >
        {bar.label}
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

export function CategoriesCardChart({
  rows,
  total,
}: {
  rows: Array<{ tier: string; count: number }>;
  total: number;
}) {
  const reduced = useReducedMotion();

  const tierBars = TIER_META.map(({ tier, color }) => ({
    label: tier,
    value: rows.find((r) => r.tier === tier)?.count ?? 0,
    color,
  }));

  if (total === 0 && tierBars.every((b) => b.value === 0)) {
    return <ChartEmpty height={88} message="No category data" />;
  }

  const maxBar = Math.max(...tierBars.map((b) => b.value), 1);
  const topTier = [...tierBars].sort((a, b) => b.value - a.value)[0];
  const topPct = total > 0 && topTier ? Math.round((topTier.value / total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">


      <div className="grid min-h-0 flex-1 grid-rows-5 gap-px">
        {tierBars.map((bar, i) => (
          <TierBarRow
            key={bar.label}
            bar={bar}
            maxBar={maxBar}
            isLeader={topTier?.label === bar.label}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>

    </div>
  );
}
