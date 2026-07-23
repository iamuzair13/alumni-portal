"use client";

import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface MetricTrendProps {
  value: string;
  positive: boolean;
  className?: string;
}

export function MetricTrend({ value, positive, className }: MetricTrendProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        positive
          ? "text-success-600 dark:text-success-400"
          : "text-error-600 dark:text-error-400",
        className
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" strokeWidth={2} aria-hidden />
      ) : (
        <TrendingDown className="h-3 w-3" strokeWidth={2} aria-hidden />
      )}
      {value}
    </span>
  );
}
