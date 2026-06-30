"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

const PUBLICATION_META = [
  { key: "storiesYtd", label: "Stories", short: "Sty", color: KPI_COLOR_HEX.violet },
  { key: "newslettersYtd", label: "Newsletters", short: "Nws", color: KPI_COLOR_HEX.indigo },
  { key: "surveys", label: "Surveys", short: "Srv", color: KPI_COLOR_HEX.amber },
  { key: "storiesQuarter", label: "Stories Q", short: "StQ", color: KPI_COLOR_HEX.sky },
] as const;

function PublicationBarRow({
  bar,
  maxBar,
  isLeader,
  index,
  reduced,
}: {
  bar: { label: string; short: string; value: number; color: string };
  maxBar: number;
  isLeader: boolean;
  index: number;
  reduced: boolean;
}) {
  const width = bar.value === 0 ? 0 : Math.max(6, (bar.value / maxBar) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-1 rounded-md px-0.5 ${
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

export function PublicationsCardChart({
  storiesYtd,
  storiesQuarter,
  newslettersYtd,
  surveys,
  quarterLabel,
}: {
  storiesYtd: number;
  storiesQuarter: number;
  newslettersYtd: number;
  surveys: number;
  quarterLabel: string;
}) {
  const reduced = useReducedMotion();

  const values = {
    storiesYtd,
    storiesQuarter,
    newslettersYtd,
    surveys,
  };

  const bars = PUBLICATION_META.map(({ key, label, short, color }) => ({
    label,
    short,
    value: values[key],
    color,
  })).filter((b) => b.value > 0);

  if (bars.length === 0) {
    return <ChartEmpty height={100} variant="premium" message="No publications yet" />;
  }

  const total = bars.reduce((sum, b) => sum + b.value, 0);
  const maxBar = Math.max(...bars.map((b) => b.value), 1);
  const topBar = [...bars].sort((a, b) => b.value - a.value)[0];
  const topPct = total > 0 && topBar ? Math.round((topBar.value / total) * 100) : 0;

  const shortQuarter =
    quarterLabel.length > 14 ? quarterLabel.replace(/\s\d{4}$/, "") : quarterLabel;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
      <div
        className="grid min-h-0 flex-1 gap-px"
        style={{ gridTemplateRows: `repeat(${Math.max(bars.length, 1)}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, i) => (
          <PublicationBarRow
            key={bar.label}
            bar={bar}
            maxBar={maxBar}
            isLeader={topBar?.label === bar.label}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>

      {topBar && topBar.value > 0 ? (
        <p
          className="shrink-0 truncate text-center text-[11px] font-medium text-violet-600/90 dark:text-violet-400/90"
          title={quarterLabel}
        >
          <span className="font-bold tabular-nums">{topPct}%</span>
          {" · "}
          {topBar.label} leads
          {storiesQuarter > 0 ? ` · ${shortQuarter}` : ""}
        </p>
      ) : null}
    </div>
  );
}
