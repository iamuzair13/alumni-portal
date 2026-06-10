"use client";

import React from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { ChartEmpty } from "./ChartEmpty";

/** Compact metric row for card-sized panels (replaces wide heatmap table). */
export function Heatmap({ data, height = 48 }: { data: ChartSeriesPoint[]; height?: number }) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <ChartEmpty height={height} />;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="grid h-full w-full grid-cols-3 gap-1">
      {data.map((d) => {
        const ratio = d.value / max;
        return (
          <div
            key={d.label}
            className="flex min-h-0 flex-col items-center justify-center rounded-md border border-violet-100/60 px-1 py-0.5 dark:border-violet-500/15"
            style={{ backgroundColor: `rgba(139, 92, 246, ${0.1 + ratio * 0.4})` }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600/80 dark:text-violet-300/80">
              {d.label}
            </span>
            <span className="text-[11px] font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">
              {d.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
