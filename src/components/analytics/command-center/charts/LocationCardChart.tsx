"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

const REGION_META = [
  { region: "Punjab", short: "Pb", color: KPI_COLOR_HEX.emerald },
  { region: "Islamabad", short: "Isb", color: "#0d9488" },
  { region: "KPK", short: "KPK", color: KPI_COLOR_HEX.sky },
  { region: "Sindh", short: "Sd", color: KPI_COLOR_HEX.indigo },
  { region: "AJK", short: "AJK", color: KPI_COLOR_HEX.violet },
  { region: "GB", short: "GB", color: KPI_COLOR_HEX.slate },
  { region: "Balochistan", short: "Bl", color: KPI_COLOR_HEX.amber },
  { region: "Overseas", short: "Intl", color: KPI_COLOR_HEX.blue },
  { region: "Other", short: "Oth", color: "#94a3b8" },
] as const;

function RegionBarRow({
  bar,
  maxBar,
  isLeader,
  index,
  reduced,
}: {
  bar: { label: string; short: string; count: number; color: string };
  maxBar: number;
  isLeader: boolean;
  index: number;
  reduced: boolean;
}) {
  const width = bar.count === 0 ? 0 : Math.max(6, (bar.count / maxBar) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-1 rounded-md px-0.5 ${
        isLeader && bar.count > 0 ? "bg-emerald-50/60 dark:bg-emerald-500/[0.06]" : ""
      }`}
      title={`${bar.label}: ${bar.count.toLocaleString()}`}
    >
      <span
        className="flex h-5 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold leading-none"
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
        {bar.count.toLocaleString()}
      </span>
    </div>
  );
}

export function LocationCardChart({
  rows,
  total,
  maxItems = 5,
}: {
  rows: Array<{ region: string; count: number }>;
  total: number;
  maxItems?: number;
}) {
  const reduced = useReducedMotion();

  const allBars = REGION_META.map(({ region, short, color }) => ({
    label: region,
    short,
    count: rows.find((r) => r.region === region)?.count ?? 0,
    color,
  }));

  const topRegion = [...allBars].sort((a, b) => b.count - a.count)[0];
  const bars = [...allBars].sort((a, b) => b.count - a.count).slice(0, maxItems);

  if (total === 0 && allBars.every((b) => b.count === 0)) {
    return <ChartEmpty height={88} message="No location data" />;
  }

  const maxBar = Math.max(...bars.map((b) => b.count), 1);
  const topPct = total > 0 && topRegion ? Math.round((topRegion.count / total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
    

      <div
        className="grid min-h-0 flex-1 gap-px"
        style={{ gridTemplateRows: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, i) => (
          <RegionBarRow
            key={bar.label}
            bar={bar}
            maxBar={maxBar}
            isLeader={topRegion?.label === bar.label && bar.count > 0}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>

      {topRegion && topRegion.count > 0 ? (
        <p className="shrink-0 truncate text-center text-[12px] font-medium text-emerald-600/90 dark:text-emerald-400/90">
          <span className="font-bold tabular-nums">{topPct}%</span>
          {" · "}
          {topRegion.label} leads
        </p>
      ) : null}
    </div>
  );
}
