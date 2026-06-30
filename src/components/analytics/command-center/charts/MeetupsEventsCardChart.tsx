"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

type StatGroup = {
  total: number;
  quarter: number;
};

const MEETUP_META = [
  { key: "events", label: "Events", short: "Evt", color: KPI_COLOR_HEX.violet },
  { key: "meetups", label: "Meetups", short: "Mtg", color: KPI_COLOR_HEX.emerald },
] as const;

export function MeetupsEventsCardChart({
  events,
  meetups,
  quarterLabel,
}: {
  events: StatGroup;
  meetups: StatGroup;
  quarterLabel: string;
}) {
  const reduced = useReducedMotion();

  const stats = { events, meetups };
  const bars = MEETUP_META.map(({ key, label, short, color }) => ({
    label,
    short,
    quarter: stats[key].quarter,
    total: stats[key].total,
    color,
  }));

  const hasData =
    events.total > 0 || events.quarter > 0 || meetups.total > 0 || meetups.quarter > 0;
  if (!hasData) return <ChartEmpty height={88} variant="premium" />;

  const maxBar = Math.max(...bars.map((b) => b.quarter), 1);
  const topBar = [...bars].sort((a, b) => b.quarter - a.quarter)[0];
  const quarterSum = events.quarter + meetups.quarter;
  const topPct = quarterSum > 0 && topBar ? Math.round((topBar.quarter / quarterSum) * 100) : 0;

  const shortQuarter =
    quarterLabel.length > 14 ? quarterLabel.replace(/\s\d{4}$/, "") : quarterLabel;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1">
        {bars.map((bar, i) => {
          const heightPct = bar.quarter === 0 ? 0 : Math.max(8, (bar.quarter / maxBar) * 100);
          const isLeader = topBar?.label === bar.label && bar.quarter > 0;
          const stagger = i * (CHART.progress.staggerMs / 1000);

          return (
            <div
              key={bar.label}
              className={`flex min-h-0 flex-col items-center rounded-lg px-0.5 pb-0.5 pt-1 ${
                isLeader ? "bg-violet-50/60 dark:bg-violet-500/[0.06]" : ""
              }`}
              title={`${bar.label}: ${bar.quarter.toLocaleString()} this quarter · ${bar.total.toLocaleString()} total`}
            >
              <span className="mb-0.5 text-[10px] font-semibold tabular-nums leading-none text-slate-800 dark:text-slate-100">
                {bar.total.toLocaleString()}
              </span>

              <div className="flex w-full min-h-0 flex-1 items-end">
                <div className="relative h-full w-full overflow-hidden rounded-md bg-slate-100/80 ring-1 ring-inset ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/50">
                  {bar.quarter > 0 ? (
                    <motion.div
                      initial={{ height: reduced ? `${heightPct}%` : 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{
                        delay: reduced ? 0 : stagger,
                        duration: reduced ? 0 : CHART.progress.duration,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="absolute bottom-0 left-0 right-0 rounded-md"
                      style={{
                        background: `linear-gradient(180deg, ${bar.color}ee, ${bar.color}99)`,
                        boxShadow: isLeader ? `0 0 12px ${bar.color}40` : undefined,
                      }}
                    />
                  ) : (
                    <div className="absolute bottom-0 left-1/2 h-0.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
                  )}
                </div>
              </div>

              <span
                className={`mt-1 max-w-full truncate text-center text-[10px] font-medium leading-none ${
                  bar.quarter > 0 ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {bar.short} · {bar.quarter.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {topBar && topBar.quarter > 0 ? (
        <p
          className="shrink-0 truncate text-center text-[11px] font-medium text-violet-600/90 dark:text-violet-400/90"
          title={quarterLabel}
        >
          <span className="font-bold tabular-nums">{topPct}%</span>
          {" · "}
          {topBar.label} this Q
          {" · "}
          {shortQuarter}
        </p>
      ) : null}
    </div>
  );
}
