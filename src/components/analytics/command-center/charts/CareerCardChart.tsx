"use client";

import React from "react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

export function CareerCardChart({
  total,
  uol,
  other,
}: {
  total: number;
  uol: number;
  other: number;
}) {
  if (total === 0 && uol === 0 && other === 0) {
    return <ChartEmpty height={100} variant="premium" message="No jobs posted yet" />;
  }

  const denominator = Math.max(uol + other, 1);
  const uolWidth = (uol / denominator) * 100;
  const otherWidth = (other / denominator) * 100;

  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-center gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">UOL</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{uol.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Other</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{other.toLocaleString()}</span>
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/70">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${uolWidth}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{ background: `linear-gradient(90deg, ${KPI_COLOR_HEX.indigo}, ${KPI_COLOR_HEX.indigo}cc)` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${otherWidth}%` }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 right-0 rounded-r-full"
          style={{ background: `linear-gradient(90deg, ${KPI_COLOR_HEX.sky}, ${KPI_COLOR_HEX.sky}cc)` }}
        />
      </div>
    </div>
  );
}
