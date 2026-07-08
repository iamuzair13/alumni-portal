"use client";

import React from "react";
import { Inbox } from "lucide-react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import type { EngagementActivityRow } from "../data/mapPayloadToCards";
import { SimpleBarList } from "./SimpleBarList";

const ACTIVITY_COLORS = [
  KPI_COLOR_HEX.violet,
  KPI_COLOR_HEX.indigo,
  KPI_COLOR_HEX.sky,
  KPI_COLOR_HEX.emerald,
  KPI_COLOR_HEX.amber,
  KPI_COLOR_HEX.rose,
] as const;

export function ActivitiesCardChart({
  rows,
  ytdTotal,
  quarterTotal,
}: {
  rows: EngagementActivityRow[];
  ytdTotal: number;
  quarterTotal: number;
}) {
  if (ytdTotal === 0 && quarterTotal === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-500 dark:bg-violet-500/12 dark:text-violet-300">
          <Inbox className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">No activities recorded yet</p>
      </div>
    );
  }

  const useYtd = ytdTotal > 0;
  const ranked = [...rows]
    .sort((a, b) => (useYtd ? b.ytd - a.ytd : b.quarter - a.quarter))
    .filter((row) => (useYtd ? row.ytd > 0 : row.quarter > 0))
    .slice(0, 5);

  const total = useYtd ? ytdTotal : quarterTotal;
  const bars = ranked.map((row, i) => ({
    label: row.activity,
    detail: useYtd
      ? `${row.quarter.toLocaleString()} this quarter`
      : `${row.ytd.toLocaleString()} year to date`,
    value: useYtd ? row.ytd : row.quarter,
    color: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length],
  }));

  return (
    <SimpleBarList items={bars} compact={total > 0 && bars.length > 4} />
  );
}
