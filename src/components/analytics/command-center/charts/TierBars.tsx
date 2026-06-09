"use client";

import React from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

/** Tier distribution bars that scale to fill available height. */
export function TierBars({ data, height = 64 }: { data: ChartSeriesPoint[]; height?: number }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <ChartEmpty height={height} />;

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const barHeight = Math.max(10, Math.min(20, Math.floor((height - filtered.length * 6) / filtered.length)));

  return (
    <div
      className="flex w-full flex-col justify-center gap-2 overflow-hidden"
      style={{ height }}
    >
      {filtered.map((d, i) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <div key={d.label} className="flex min-w-0 items-center gap-2">
            <span className="w-7 shrink-0 text-[10px] font-bold text-gray-500 dark:text-gray-400">
              {d.label}
            </span>
            <div
              className="min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
              style={{ height: barHeight }}
            >
              <div
                className="flex h-full items-center rounded-full px-1.5"
                style={{
                  width: `${Math.max(8, pct)}%`,
                  backgroundColor: d.color ?? colorAt(i),
                }}
              >
                {pct >= 18 ? (
                  <span className="truncate text-[9px] font-semibold text-white">{d.value}</span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
