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
  if (!filtered.length) return <ChartEmpty height={48} message="No perks active" />;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex w-full flex-col justify-center gap-1.5">
      {filtered.map((p, i) => (
        <div key={p.label} className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
          <span className="truncate text-right text-[10px] font-medium text-gray-500 dark:text-gray-400">
            {p.label}
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className={`h-full rounded-full ${accentClass}`}
              style={{
                width: `${Math.max(4, (p.value / max) * 100)}%`,
                backgroundColor: p.color ?? colorAt(i),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
