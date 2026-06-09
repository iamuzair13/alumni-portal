"use client";

import React from "react";
import type { KpiConfigItem } from "../utils/kpiConfig";

export function MetricChipStrip({
  items,
  compact,
  size = "sm",
}: {
  items: KpiConfigItem[];
  compact?: boolean;
  size?: "sm" | "md";
}) {
  if (!items.length) return null;

  const chipClass =
    size === "md"
      ? "gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
      : "gap-1 rounded-md px-1.5 py-0.5 text-[10px]";
  const labelClass = size === "md" ? "font-medium text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400";
  const valueClass =
    size === "md" ? "text-sm font-bold text-gray-900 dark:text-white" : "font-semibold text-gray-900 dark:text-white";
  const secondaryClass =
    size === "md" ? "ml-1 text-xs font-semibold text-gray-500 dark:text-gray-400" : "ml-1 font-medium text-gray-500 dark:text-gray-400";

  return (
    <div
      className={`flex flex-wrap ${size === "md" ? "gap-2" : "gap-1"} ${compact ? "max-h-[52px] overflow-hidden" : ""}`}
      aria-label="Key metrics"
    >
      {items.map((item) => (
        <span
          key={item.title}
          className={`inline-flex max-w-full items-center border border-gray-200/80 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/80 ${chipClass}`}
          title={item.subtitle ? `${item.title}: ${item.value} — ${item.subtitle}` : `${item.title}: ${item.value}`}
        >
          <span className={`truncate ${labelClass}`}>{item.title}</span>
          <span className={`shrink-0 tabular-nums ${valueClass}`}>
            {item.value}
            {item.secondaryValue ? <span className={secondaryClass}>{item.secondaryValue}</span> : null}
          </span>
        </span>
      ))}
    </div>
  );
}
