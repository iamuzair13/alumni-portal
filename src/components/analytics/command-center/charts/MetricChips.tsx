"use client";

import React from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

export function MetricChips({
  data,
  maxItems = 3,
  emptyMessage = "No data",
  variant = "rows",
}: {
  data: ChartSeriesPoint[];
  maxItems?: number;
  emptyMessage?: string;
  /** rows = compact list for split cards; grid = tile layout for wider panels */
  variant?: "rows" | "grid";
}) {
  const items = data.filter((d) => d.value > 0).slice(0, maxItems);
  if (!items.length) return <ChartEmpty compact message={emptyMessage} />;

  const formatValue = (d: ChartSeriesPoint) =>
    typeof d.value === "number" && d.label.includes("%")
      ? `${d.value}%`
      : d.value.toLocaleString();

  if (variant === "rows") {
    return (
      <div className="flex w-full min-w-0 flex-col justify-center gap-0.5">
        {items.map((d, i) => (
          <div
            key={d.label}
            className="flex min-w-0 items-center justify-between gap-1 rounded border border-violet-100/70 bg-violet-50/50 px-1.5 py-0.5 dark:border-violet-500/15 dark:bg-violet-500/10"
          >
            <span
              className="min-w-0 truncate text-[9px] font-medium text-gray-500 dark:text-gray-400"
              title={d.label}
            >
              {d.label}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: d.color ?? colorAt(i) }}
              />
              {formatValue(d)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const cols = items.length === 1 ? 1 : items.length === 2 ? 2 : 3;

  return (
    <div
      className="grid w-full min-w-0 gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((d, i) => (
        <div
          key={d.label}
          className="flex min-w-0 flex-col items-center justify-center rounded-md border border-violet-100/80 bg-violet-50/60 px-1 py-0.5 dark:border-violet-500/15 dark:bg-violet-500/10"
        >
          <span
            className="w-full truncate text-center text-[9px] font-medium text-gray-500 dark:text-gray-400"
            title={d.label}
          >
            {d.label}
          </span>
          <span className="text-[10px] font-bold tabular-nums leading-tight text-gray-900 dark:text-gray-100">
            {formatValue(d)}
          </span>
        </div>
      ))}
    </div>
  );
}
