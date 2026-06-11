"use client";

import React from "react";
import { motion } from "motion/react";
import type { EngagementActivityRow } from "../data/mapPayloadToCards";
import { ChartEmpty } from "./ChartEmpty";

function SummaryTile({
  title,
  value,
  subtitle,
  accent,
  delay = 0,
}: {
  title: string;
  value: number;
  subtitle: string;
  accent: "violet" | "indigo";
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-xl border px-2.5 py-2 ${
        accent === "violet"
          ? "border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-500/20 dark:from-violet-500/10 dark:to-gray-900/40"
          : "border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-white dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-gray-900/40"
      }`}
    >
      <p
        className={`text-[9px] font-semibold uppercase tracking-wider ${
          accent === "violet"
            ? "text-violet-600 dark:text-violet-400"
            : "text-indigo-600 dark:text-indigo-400"
        }`}
      >
        {title}
      </p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums leading-none ${
          accent === "violet"
            ? "text-violet-700 dark:text-violet-300"
            : "text-indigo-700 dark:text-indigo-300"
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1 truncate text-[8px] font-medium text-slate-400 dark:text-slate-500" title={subtitle}>
        {subtitle}
      </p>
    </motion.div>
  );
}

function ActivityRow({ row, delay = 0 }: { row: EngagementActivityRow; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-violet-100/80 bg-white/70 px-2 py-1 dark:border-violet-500/15 dark:bg-gray-900/30"
    >
      <span className="min-w-0 truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
        {row.activity}
      </span>
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        <span className="text-violet-600 dark:text-violet-400">{row.quarter.toLocaleString()}</span>
        <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
        <span>{row.ytd.toLocaleString()} YTD</span>
      </span>
    </motion.div>
  );
}

export function ActivitiesCardChart({
  quarterTotal,
  ytdTotal,
  quarterLabel,
  topRows,
}: {
  quarterTotal: number;
  ytdTotal: number;
  quarterLabel: string;
  topRows: EngagementActivityRow[];
}) {
  if (ytdTotal === 0 && quarterTotal === 0) {
    return <ChartEmpty height={100} variant="premium" message="No activities recorded yet" />;
  }

  const shortQuarter =
    quarterLabel.length > 14 ? quarterLabel.replace(/\s\d{4}$/, "") : quarterLabel;
  const visibleRows = topRows.filter((row) => row.ytd > 0 || row.quarter > 0);

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <SummaryTile
          title="This Q"
          value={quarterTotal}
          subtitle={shortQuarter}
          accent="violet"
          delay={0.05}
        />
        <SummaryTile
          title="YTD"
          value={ytdTotal}
          subtitle="6 activity types"
          accent="indigo"
          delay={0.1}
        />
      </div>
      {visibleRows.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
          {visibleRows.map((row, i) => (
            <ActivityRow key={row.activity} row={row} delay={0.14 + i * 0.05} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
