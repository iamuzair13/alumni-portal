"use client";

import React from "react";
import { motion } from "motion/react";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

export type ScholarshipCardRow = {
  type: string;
  short: string;
  applied: number;
  approved: number;
  color: string;
};

function TypeBarRow({
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

export function ScholarshipsCardChart({
  rows,
  total,
}: {
  rows: ScholarshipCardRow[];
  total: number;
}) {
  const reduced = useReducedMotion();

  const typeBars = rows.map((row) => ({
    label: row.type,
    short: row.short,
    value: row.approved,
    color: row.color,
  }));

  if (total === 0 && typeBars.every((b) => b.value === 0)) {
    return <ChartEmpty height={88} message="No scholarship data" />;
  }

  const maxBar = Math.max(...typeBars.map((b) => b.value), 1);
  const topType = [...typeBars].sort((a, b) => b.value - a.value)[0];
  const topPct = total > 0 && topType ? Math.round((topType.value / total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-px">
        {typeBars.map((bar, i) => (
          <TypeBarRow
            key={bar.label}
            bar={bar}
            maxBar={maxBar}
            isLeader={topType?.label === bar.label}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>

      {topType && topType.value > 0 ? (
        <p className="shrink-0 truncate text-center text-[12px] font-medium text-violet-600/90 dark:text-violet-400/90">
          <span className="font-bold tabular-nums">{topPct}%</span>
          {" · "}
          {topType.label} leads
        </p>
      ) : null}
    </div>
  );
}
