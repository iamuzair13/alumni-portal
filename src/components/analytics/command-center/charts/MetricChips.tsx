"use client";

import React from "react";
import { motion } from "motion/react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

export function MetricChips({
  data,
  maxItems = 3,
  emptyMessage = "No data",
  variant = "rows",
  premium = false,
}: {
  data: ChartSeriesPoint[];
  maxItems?: number;
  emptyMessage?: string;
  variant?: "rows" | "grid";
  premium?: boolean;
}) {
  const items = data.filter((d) => d.value > 0).slice(0, maxItems);
  if (!items.length) {
    return (
      <ChartEmpty
        compact={!premium}
        variant={premium ? "premium" : "default"}
        message={emptyMessage}
      />
    );
  }

  const formatValue = (d: ChartSeriesPoint) =>
    typeof d.value === "number" && d.label.includes("%")
      ? `${d.value}%`
      : d.value.toLocaleString();

  if (variant === "rows") {
    return (
      <div className={`flex w-full min-w-0 flex-col justify-center ${premium ? "gap-2" : "gap-0.5"}`}>
        {items.map((d, i) => (
          <motion.div
            key={d.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            whileHover={premium ? { y: -1 } : undefined}
            className={
              premium
                ? "flex min-w-0 items-center justify-between gap-2 rounded-full border border-violet-200/60 bg-violet-50/80 px-3 py-1.5 transition-colors hover:border-violet-300/80 hover:bg-violet-100/80 dark:border-violet-500/20 dark:bg-violet-500/10 dark:hover:bg-violet-500/15"
                : "flex min-w-0 items-center justify-between gap-1 rounded border border-violet-100/70 bg-violet-50/50 px-1.5 py-0.5 dark:border-violet-500/15 dark:bg-violet-500/10"
            }
          >
            <span
              className={`min-w-0 truncate font-medium text-slate-500 dark:text-slate-400 ${premium ? "text-[11px]" : "text-[9px]"}`}
              title={d.label}
            >
              {d.label}
            </span>
            <span
              className={`flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-slate-900 dark:text-white ${premium ? "text-xs" : "text-[10px]"}`}
            >
              <span
                className={`rounded-full ${premium ? "h-2 w-2" : "h-1.5 w-1.5"}`}
                style={{ backgroundColor: d.color ?? colorAt(i) }}
              />
              {formatValue(d)}
            </span>
          </motion.div>
        ))}
      </div>
    );
  }

  const cols = items.length === 1 ? 1 : items.length === 2 ? 2 : 3;

  return (
    <div
      className={`grid w-full min-w-0 ${premium ? "gap-2" : "gap-1"}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((d, i) => (
        <motion.div
          key={d.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.06 }}
          className={
            premium
              ? "flex min-w-0 flex-col items-center justify-center rounded-full border border-violet-200/60 bg-violet-50/80 px-2 py-1.5 dark:border-violet-500/20 dark:bg-violet-500/10"
              : "flex min-w-0 flex-col items-center justify-center rounded-md border border-violet-100/80 bg-violet-50/60 px-1 py-0.5 dark:border-violet-500/15 dark:bg-violet-500/10"
          }
        >
          <span
            className="w-full truncate text-center text-[9px] font-medium text-slate-500 dark:text-slate-400"
            title={d.label}
          >
            {d.label}
          </span>
          <span className="text-[10px] font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
            {formatValue(d)}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
