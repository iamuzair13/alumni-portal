"use client";

import React from "react";

type ChipColor = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

const BORDER_COLORS: Record<ChipColor, string> = {
  indigo: "border-l-indigo-400 dark:border-l-indigo-500",
  emerald: "border-l-emerald-400 dark:border-l-emerald-500",
  amber: "border-l-amber-400 dark:border-l-amber-500",
  rose: "border-l-rose-400 dark:border-l-rose-500",
  sky: "border-l-sky-400 dark:border-l-sky-500",
  violet: "border-l-violet-400 dark:border-l-violet-500",
  slate: "border-l-slate-400 dark:border-l-slate-500",
};

export function CompactMetricChip({
  label,
  value,
  hint,
  color = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  color?: ChipColor;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200/80 border-l-[3px] bg-white/60 px-2.5 py-1.5 dark:border-gray-800 dark:bg-gray-900/40 ${BORDER_COLORS[color]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
      {hint ? <p className="text-[10px] text-gray-400 dark:text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function MetricChipRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 ${className}`}>{children}</div>
  );
}
