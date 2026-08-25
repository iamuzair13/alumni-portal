"use client";

import React from "react";
import { twMerge } from "tailwind-merge";

export interface StatTileProps {
  label: string;
  value: number;
  total: number;
  dotColor?: string;
  barColor?: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatTile({
  label,
  value,
  total,
  dotColor = "bg-accent-500",
  barColor,
  isSelected = false,
  onClick,
  className,
}: StatTileProps) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const effectiveBarColor = barColor ?? dotColor;

  const content = (
    <>
      <div className="flex items-center min-w-20 gap-1">
        <span className={twMerge("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
        <span className="truncate text-[10px] font-semibold uppercase leading-3 tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <p
        className={twMerge(
          "mt-0.5 text-lg font-bold leading-5 tabular-nums",
          isSelected ? "text-accent-700 dark:text-accent-300" : "text-gray-900 dark:text-white"
        )}
      >
        {value.toLocaleString()}
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={twMerge("h-full rounded-full transition-all duration-500", effectiveBarColor)}
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
          "rounded-lg border p-2.5 text-left transition-all",
          isSelected
            ? "border-accent-400 bg-accent-50/70 ring-2 ring-accent-500/30 shadow-theme-sm dark:border-accent-600 dark:bg-accent-900/20 dark:ring-accent-400/30"
            : "border-gray-200/60 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800/60 dark:bg-gray-900/40 dark:hover:border-gray-700 dark:hover:bg-gray-800/40",
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={twMerge(
        "rounded-lg border border-gray-200/60 bg-white p-2.5 dark:border-gray-800/60 dark:bg-gray-900/40",
        className
      )}
    >
      {content}
    </div>
  );
}
