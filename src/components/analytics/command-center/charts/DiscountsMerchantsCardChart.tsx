"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

type Accent = "violet" | "amber" | "indigo" | "emerald" | "sky" | "rose";

function MetricTile({
  label,
  value,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  accent: Accent;
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
    sky: {
      border: "border-sky-200/70 dark:border-sky-500/20",
      bg: "from-sky-50/90 to-white dark:from-sky-500/10 dark:to-gray-900/40",
      label: "text-sky-600 dark:text-sky-400",
      value: "text-sky-700 dark:text-sky-300",
    },
    rose: {
      border: "border-rose-200/70 dark:border-rose-500/20",
      bg: "from-rose-50/90 to-white dark:from-rose-500/10 dark:to-gray-900/40",
      label: "text-rose-600 dark:text-rose-400",
      value: "text-rose-700 dark:text-rose-300",
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
  travel,
  health,
  professional,
  financial,
  merchantCount,
}: {
  total: number;
  dining: number;
  retail: number;
  travel: number;
  health: number;
  professional: number;
  financial: number;
  merchantCount: number;
}) {
  const tiles = [
    { label: "Total discounts", value: total, accent: "violet" as const },
    { label: "Dining & cafés", value: dining, accent: "amber" as const },
    { label: "Retail & shopping", value: retail, accent: "indigo" as const },
    { label: "Travel & leisure", value: travel, accent: "sky" as const },
    { label: "Health & wellness", value: health, accent: "emerald" as const },
    { label: "Professional", value: professional, accent: "violet" as const },
    { label: "Financial", value: financial, accent: "rose" as const },
    { label: "Partner merchants", value: merchantCount, accent: "emerald" as const },
  ].filter((tile) => tile.value > 0);

  if (tiles.length === 0) {
    return <ChartEmpty height={100} variant="premium" message="No discounts or merchants yet" />;
  }

  const gridClass = tiles.length === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className={`grid h-full w-full ${gridClass} gap-2`}>
      {tiles.map((tile, i) => (
        <MetricTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          accent={tile.accent}
          delay={0.05 + i * 0.04}
        />
      ))}
    </div>
  );
}
