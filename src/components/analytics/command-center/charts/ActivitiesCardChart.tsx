"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import type { EngagementActivityRow } from "../data/mapPayloadToCards";
import { ChartEmpty } from "./ChartEmpty";

const ACTIVITY_COLORS = [
  KPI_COLOR_HEX.violet,
  KPI_COLOR_HEX.indigo,
  KPI_COLOR_HEX.sky,
  KPI_COLOR_HEX.emerald,
  KPI_COLOR_HEX.amber,
  KPI_COLOR_HEX.rose,
] as const;

const ACTIVITY_SHORT: Record<string, string> = {
  Mentorship: "Ment",
  Seminars: "Sem",
  Conferences: "Conf",
  "Alumni Talks": "Talk",
  "High Achievers": "Achv",
  Wellbeing: "Well",
};

function ActivityBarRow({
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

export function ActivitiesCardChart({
  rows,
  ytdTotal,
  quarterTotal,
  topByYtd,
}: {
  rows: EngagementActivityRow[];
  ytdTotal: number;
  quarterTotal: number;
  topByYtd: EngagementActivityRow;
}) {
  const reduced = useReducedMotion();

  if (ytdTotal === 0 && quarterTotal === 0) {
    return <ChartEmpty height={100} variant="premium" message="No activities recorded yet" />;
  }

  const useYtd = ytdTotal > 0;
  const ranked = [...rows]
    .sort((a, b) => (useYtd ? b.ytd - a.ytd : b.quarter - a.quarter))
    .filter((row) => (useYtd ? row.ytd > 0 : row.quarter > 0))
    .slice(0, 5);

  const total = useYtd ? ytdTotal : quarterTotal;
  const bars = ranked.map((row, i) => ({
    label: row.activity,
    short: ACTIVITY_SHORT[row.activity] ?? row.activity.slice(0, 4),
    value: useYtd ? row.ytd : row.quarter,
    color: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length],
  }));

  const maxBar = Math.max(...bars.map((b) => b.value), 1);
  const topBar = bars[0];
  const topPct = total > 0 && topBar ? Math.round((topBar.value / total) * 100) : 0;
  const leaderLabel = topByYtd.ytd > 0 ? topByYtd.activity : topBar?.label;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
      <div
        className="grid min-h-0 flex-1 gap-px"
        style={{ gridTemplateRows: `repeat(${Math.max(bars.length, 1)}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, i) => (
          <ActivityBarRow
            key={bar.label}
            bar={bar}
            maxBar={maxBar}
            isLeader={topBar?.label === bar.label}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>

      {topBar && topBar.value > 0 && leaderLabel ? (
        <p className="shrink-0 truncate text-center text-[11px] font-medium text-violet-600/90 dark:text-violet-400/90">
          <span className="font-bold tabular-nums">{topPct}%</span>
          {" · "}
          {leaderLabel} leads {useYtd ? "YTD" : "this Q"}
        </p>
      ) : null}
    </div>
  );
}
