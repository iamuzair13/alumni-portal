"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

type StatGroup = {
  total: number;
  quarter: number;
};

function StatPanel({
  title,
  accent,
  trackClass,
  valueClass,
  stats,
  quarterLabel,
  delay = 0,
}: {
  title: string;
  accent: "violet" | "emerald";
  trackClass: string;
  valueClass: string;
  stats: StatGroup;
  quarterLabel: string;
  delay?: number;
}) {
  const shortQuarter =
    quarterLabel.length > 14 ? quarterLabel.replace(/\s\d{4}$/, "") : quarterLabel;
  const share = stats.total > 0 ? Math.max(8, (stats.quarter / stats.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex min-h-0 flex-1 flex-col rounded-xl border px-2.5 py-2 ${
        accent === "violet"
          ? "border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-500/20 dark:from-violet-500/10 dark:to-gray-900/40"
          : "border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-gray-900/40"
      }`}
    >
      <p
        className={`text-[9px] font-semibold uppercase tracking-wider ${
          accent === "violet"
            ? "text-violet-600 dark:text-violet-400"
            : "text-emerald-600 dark:text-emerald-400"
        }`}
      >
        {title}
      </p>

      <div className="mt-2 grid flex-1 grid-cols-2 gap-1.5">
        <div className="min-w-0">
          <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400">Total</p>
          <p className={`text-lg font-bold tabular-nums leading-tight ${valueClass}`}>
            {stats.total.toLocaleString()}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400">This Q</p>
          <p className={`text-lg font-bold tabular-nums leading-tight ${valueClass}`}>
            {stats.quarter.toLocaleString()}
          </p>
          <p className="mt-0.5 truncate text-[8px] font-medium text-slate-400 dark:text-slate-500" title={quarterLabel}>
            {shortQuarter}
          </p>
        </div>
      </div>

      <div className="mt-2">
        <div className={`h-1.5 overflow-hidden rounded-full ${trackClass}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${share}%` }}
            transition={{ delay: delay + 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className={`h-full rounded-full ${
              accent === "violet"
                ? "bg-gradient-to-r from-violet-500 to-violet-400"
                : "bg-gradient-to-r from-emerald-500 to-emerald-400"
            }`}
          />
        </div>
        <p className="mt-1 text-[8px] text-slate-400 dark:text-slate-500">
          {stats.total > 0
            ? `${Math.round((stats.quarter / stats.total) * 100)}% this quarter`
            : "No activity"}
        </p>
      </div>
    </motion.div>
  );
}

export function MeetupsEventsCardChart({
  events,
  meetups,
  quarterLabel,
}: {
  events: StatGroup;
  meetups: StatGroup;
  quarterLabel: string;
}) {
  const hasData =
    events.total > 0 || events.quarter > 0 || meetups.total > 0 || meetups.quarter > 0;
  if (!hasData) return <ChartEmpty height={88} />;

  return (
    <div className="grid h-full w-full grid-cols-2 gap-2">
      <StatPanel
        title="Events"
        accent="violet"
        trackClass="bg-violet-100 dark:bg-violet-500/15"
        valueClass="text-violet-700 dark:text-violet-300"
        stats={events}
        quarterLabel={quarterLabel}
        delay={0.05}
      />
      <StatPanel
        title="Meetups"
        accent="emerald"
        trackClass="bg-emerald-100 dark:bg-emerald-500/15"
        valueClass="text-emerald-700 dark:text-emerald-300"
        stats={meetups}
        quarterLabel={quarterLabel}
        delay={0.12}
      />
    </div>
  );
}
