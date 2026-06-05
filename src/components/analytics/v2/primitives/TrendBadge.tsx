"use client";

import React from "react";

export function TrendBadge({
  value,
  positive,
  compact = false,
}: {
  value: string;
  positive: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded font-semibold ${
        compact ? "px-1 py-0 text-[9px]" : "rounded-full px-1.5 py-0.5 text-[10px]"
      } ${
        positive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
      }`}
    >
      {positive ? "↑" : "↓"}
      {value}
    </span>
  );
}
