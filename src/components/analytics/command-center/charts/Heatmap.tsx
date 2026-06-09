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
    <div className="grid w-full grid-cols-3 gap-1" style={{ minHeight: height }}>
      {data.map((d) => {
        const ratio = d.value / max;
        return (
          <div
            key={d.label}
            className="flex flex-col items-center justify-center rounded-md px-1 py-1"
            style={{ backgroundColor: `rgba(139, 92, 246, ${0.12 + ratio * 0.45})` }}
          >
            <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">{d.label}</span>
            <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {d.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
