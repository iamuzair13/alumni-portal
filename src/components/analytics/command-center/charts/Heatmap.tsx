"use client";

import React from "react";
import { motion } from "motion/react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { ChartEmpty } from "./ChartEmpty";


/** Compact metric row for card-sized panels. */
export function Heatmap({
  data,
  height = 48,
  variant = "default",
}: {
  data: ChartSeriesPoint[];
  height?: number;
  variant?: "default" | "premium";
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <ChartEmpty height={height} variant={variant === "premium" ? "premium" : "default"} />;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const isPremium = variant === "premium";

  return (
    <div className={`grid h-full w-full grid-cols-3 ${isPremium ? "gap-1.5" : "gap-1"}`}>
      {data.map((d, i) => {
        const ratio = d.value / max;
        return (
          <motion.div
            key={d.label}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
            className={`flex min-h-0 flex-col items-center justify-center border border-violet-200/60 px-1.5 py-1 dark:border-violet-500/20 ${
              isPremium ? "rounded-sm" : "rounded-md"
            }`}
            style={{ backgroundColor: `rgba(139, 92, 246, ${0.1 + ratio * 0.42})` }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/90">
              {d.label}
            </span>
            <span className="text-[11px] font-bold leading-tight tabular-nums text-slate-900 dark:text-white">
              {d.value.toLocaleString()}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
