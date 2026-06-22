"use client";

import React from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { Bar } from "./Bar";
import { ChartEmpty } from "./ChartEmpty";

export function ChaptersCardChart({
  national,
  international,
  height = 80,
}: {
  national: ChartSeriesPoint[];
  international: ChartSeriesPoint[];
  height?: number;
}) {
  const nationalAlumni = national.filter((p) => p.label === "Alumni");
  const internationalAlumni = international.filter((p) => p.label === "Alumni");
  const hasData =
    nationalAlumni.some((p) => p.value > 0) || internationalAlumni.some((p) => p.value > 0);
  if (!hasData) return <ChartEmpty height={height} />;

  const chartHeight = Math.max(56, height - 18);

  return (
    <div className="grid h-full w-full grid-cols-2 gap-2">
      <div className="flex min-h-0 flex-col">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
          National
        </p>
        <Bar data={nationalAlumni} horizontal={false} height={chartHeight} variant="premium" showLabels />
      </div>
      <div className="flex min-h-0 flex-col">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          International
        </p>
        <Bar data={internationalAlumni} horizontal={false} height={chartHeight} variant="premium" showLabels />
      </div>
    </div>
  );
}
