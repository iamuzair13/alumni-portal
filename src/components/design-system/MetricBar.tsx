"use client";

import React from "react";
import { twMerge } from "tailwind-merge";

export interface MetricBarProps {
  label: string;
  value: number;
  total: number;
  isSelected?: boolean;
  onClick?: () => void;
  dotColor?: string;
  className?: string;
}

export function MetricBar({
  label,
  value,
  total,
  isSelected = false,
  onClick,
  dotColor = "bg-accent-500",
  className,
}: MetricBarProps) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          <span className={twMerge("h-2 w-2 rounded-full", dotColor)} />
          {label}
        </span>
        <span
          className={twMerge(
            "text-sm font-semibold tabular-nums",
            isSelected ? "text-accent-700 dark:text-accent-300" : "text-gray-900 dark:text-gray-100"
          )}
        >
          {value.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={twMerge(
            "h-full rounded-full transition-all duration-500",
            isSelected ? "bg-accent-500" : dotColor
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        role="tab"
        aria-selected={isSelected}
        className={twMerge(
          "w-full rounded-lg p-2.5 text-left transition-colors",
          isSelected
            ? "bg-accent-50/60 ring-1 ring-accent-500/15 dark:bg-accent-900/10 dark:ring-accent-500/15"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
          className
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={twMerge("rounded-lg p-2.5", className)}>{content}</div>;
}
