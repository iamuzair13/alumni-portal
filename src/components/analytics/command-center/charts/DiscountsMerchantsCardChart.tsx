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
  accent: "violet" | "amber" | "indigo" | "emerald";
  delay?: number;
}) {
  const styles = {
    violet: {
      border: "border-violet-200/70 dark:border-violet-500/20",
      bg: "from-violet-50/90 to-white dark:from-violet-500/10 dark:to-gray-900/40",
      label: "text-violet-600 dark:text-violet-400",
      value: "text-violet-700 dark:text-violet-300",
    },
    amber: {
      border: "border-amber-200/70 dark:border-amber-500/20",
      bg: "from-amber-50/90 to-white dark:from-amber-500/10 dark:to-gray-900/40",
      label: "text-amber-600 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-300",
    },
    indigo: {
      border: "border-indigo-200/70 dark:border-indigo-500/20",
      bg: "from-indigo-50/90 to-white dark:from-indigo-500/10 dark:to-gray-900/40",
      label: "text-indigo-600 dark:text-indigo-400",
      value: "text-indigo-700 dark:text-indigo-300",
    },
    emerald: {
      border: "border-emerald-200/70 dark:border-emerald-500/20",
      bg: "from-emerald-50/90 to-white dark:from-emerald-500/10 dark:to-gray-900/40",
      label: "text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-300",
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

export function DiscountsMerchantsCardChart({
  total,
  dining,
  retail,
  merchantCount,
}: {
  total: number;
  dining: number;
  retail: number;
  merchantCount: number;
}) {
  if (total === 0 && dining === 0 && retail === 0 && merchantCount === 0) {
    return <ChartEmpty height={100} variant="premium" message="No discounts or merchants yet" />;
  }

  return (
    <div className="grid h-full w-full grid-cols-2 gap-2">
      <MetricTile label="Total discounts" value={total} accent="violet" delay={0.05} />
      <MetricTile label="Dining & cafés" value={dining} accent="amber" delay={0.1} />
      <MetricTile label="Retail & shopping" value={retail} accent="indigo" delay={0.14} />
      <MetricTile label="Partner merchants" value={merchantCount} accent="emerald" delay={0.18} />
    </div>
  );
}
