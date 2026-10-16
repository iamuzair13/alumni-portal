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
          ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400"
          : "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400"
      }`}
    >
      {positive ? "↑" : "↓"}
      {value}
    </span>
  );
}
