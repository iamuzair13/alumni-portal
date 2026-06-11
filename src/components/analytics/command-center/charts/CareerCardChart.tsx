"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

function MetricTile({
  label,
  value,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  accent: "violet" | "indigo" | "sky" | "amber";
  delay?: number;
}) {
  const styles = {
    violet: {
      border: "border-violet-200/70 dark:border-violet-500/20",
      bg: "from-violet-50/90 to-white dark:from-violet-500/10 dark:to-gray-900/40",
      label: "text-violet-600 dark:text-violet-400",
      value: "text-violet-700 dark:text-violet-300",
    },
    indigo: {
      border: "border-indigo-200/70 dark:border-indigo-500/20",
      bg: "from-indigo-50/90 to-white dark:from-indigo-500/10 dark:to-gray-900/40",
      label: "text-indigo-600 dark:text-indigo-400",
      value: "text-indigo-700 dark:text-indigo-300",
    },
    sky: {
      border: "border-sky-200/70 dark:border-sky-500/20",
      bg: "from-sky-50/90 to-white dark:from-sky-500/10 dark:to-gray-900/40",
      label: "text-sky-600 dark:text-sky-400",
      value: "text-sky-700 dark:text-sky-300",
    },
    amber: {
      border: "border-amber-200/70 dark:border-amber-500/20",
      bg: "from-amber-50/90 to-white dark:from-amber-500/10 dark:to-gray-900/40",
      label: "text-amber-600 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-300",
    },
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex min-h-0 flex-col justify-center rounded-xl border bg-gradient-to-br px-2.5 py-2 ${styles.border} ${styles.bg}`}
    >
      <p className={`text-[9px] font-semibold uppercase tracking-wider ${styles.label}`}>{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums leading-none ${styles.value}`}>
        {value.toLocaleString()}
      </p>
    </motion.div>
  );
}

export function CareerCardChart({
  total,
  uol,
  other,
  quarter,
  quarterLabel,
}: {
  total: number;
  uol: number;
  other: number;
  quarter: number;
  quarterLabel: string;
}) {
  if (total === 0 && uol === 0 && other === 0 && quarter === 0) {
    return <ChartEmpty height={100} variant="premium" message="No jobs posted yet" />;
  }

  const shortQuarter =
    quarterLabel.length > 14 ? quarterLabel.replace(/\s\d{4}$/, "") : quarterLabel;

  return (
    <div className="grid h-full w-full grid-cols-2 gap-2">
      <MetricTile label="Total jobs" value={total} accent="violet" delay={0.05} />
      <MetricTile label="UOL" value={uol} accent="indigo" delay={0.1} />
      <MetricTile label="Other employers" value={other} accent="sky" delay={0.14} />
      <div className="flex min-h-0 flex-col justify-center rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white px-2.5 py-2 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-gray-900/40">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          This Q
        </p>
        <p className="mt-1 text-lg font-bold tabular-nums leading-none text-amber-700 dark:text-amber-300">
          {quarter.toLocaleString()}
        </p>
        <p className="mt-1 truncate text-[8px] font-medium text-slate-400 dark:text-slate-500" title={quarterLabel}>
          {shortQuarter}
        </p>
      </div>
    </div>
  );
}
