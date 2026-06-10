"use client";

import React from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";
import { ChartEmpty } from "./ChartEmpty";

export function ProgressBars({
  data,
  maxItems = 3,
  accentClass = "bg-violet-500 dark:bg-violet-400",
}: {
  data: ChartSeriesPoint[];
  maxItems?: number;
  accentClass?: string;
}) {
  const filtered = data.filter((d) => d.value > 0).slice(0, maxItems);
  if (!filtered.length) return <ChartEmpty compact message="No perks active" />;

  const max = Math.max(...filtered.map((d) => d.value), 1);

  return (
    <div className="flex w-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden">
      {filtered.map((p, i) => {
        const pct = Math.min(100, Math.max(4, (p.value / max) * 100));
        return (
          <div key={p.label} className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-1">
            <span
              className="truncate text-right text-[9px] font-medium text-gray-500 dark:text-gray-400"
              title={p.label}
            >
              {p.label}
            </span>
            <div className="min-w-0 overflow-hidden rounded-full bg-gray-200/90 dark:bg-gray-800">
              <div
                className={`h-1.5 max-w-full rounded-full ${accentClass}`}
                style={{
                  width: `${pct}%`,
                  backgroundColor: p.color ?? colorAt(i),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
