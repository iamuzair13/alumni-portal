"use client";

import React from "react";
import { motion } from "motion/react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

export function ProgressBars({
  data,
  maxItems = 3,
  accentClass = "bg-violet-500 dark:bg-violet-400",
  variant = "default",
}: {
  data: ChartSeriesPoint[];
  maxItems?: number;
  accentClass?: string;
  variant?: "default" | "premium";
}) {
  const filtered = data.filter((d) => d.value > 0).slice(0, maxItems);
  if (!filtered.length) {
    return (
      <ChartEmpty
        compact={variant !== "premium"}
        variant={variant === "premium" ? "premium" : "default"}
        message="No perks active"
      />
    );
  }

  const max = Math.max(...filtered.map((d) => d.value), 1);
  const isPremium = variant === "premium";

  return (
    <div className={`flex w-full min-w-0 flex-col justify-center overflow-hidden ${isPremium ? "gap-2" : "gap-0.5"}`}>
      {filtered.map((p, i) => {
        const pct = Math.min(100, Math.max(4, (p.value / max) * 100));
        const fill = p.color ?? colorAt(i);
        return (
          <div
            key={p.label}
            className={`grid min-w-0 items-center gap-2 ${isPremium ? "grid-cols-[3rem_minmax(0,1fr)]" : "grid-cols-[2.25rem_minmax(0,1fr)]"}`}
          >
            <span
              className="truncate text-right text-[10px] font-medium text-slate-500 dark:text-slate-400"
              title={p.label}
            >
              {p.label}
            </span>
            <div
              className={`min-w-0 overflow-hidden ${isPremium ? "rounded-full bg-slate-100 dark:bg-slate-800" : "rounded-full bg-gray-200/90 dark:bg-gray-800"}`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={`h-2 max-w-full rounded-full ${isPremium ? "" : accentClass}`}
                style={
                  isPremium
                    ? { background: `linear-gradient(90deg, #7c3aed, #a78bfa)` }
                    : { backgroundColor: fill }
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
