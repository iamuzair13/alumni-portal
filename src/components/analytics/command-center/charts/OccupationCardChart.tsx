"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

const OCCUPATION_META = [
  { status: "Employed", short: "Emp", color: KPI_COLOR_HEX.emerald },
  { status: "Self-employed", short: "Self", color: KPI_COLOR_HEX.sky },
  { status: "Unemployed (searching)", short: "UE(s)", color: KPI_COLOR_HEX.amber },
  { status: "Unemployed (by choice)", short: "UE(c)", color: KPI_COLOR_HEX.orange },
  { status: "Pursuing higher education", short: "HiEd", color: KPI_COLOR_HEX.slate },
] as const;

export function OccupationCardChart({
  rows,
  total,
}: {
  rows: Array<{ status: string; count: number }>;
  total: number;
}) {
  const reduced = useReducedMotion();

  const bars = OCCUPATION_META.map(({ status, short, color }) => ({
    label: status,
    short,
    value: rows.find((r) => r.status === status)?.count ?? 0,
    color,
  }));

  if (total === 0 && bars.every((b) => b.value === 0)) {
    return <ChartEmpty height={88} message="No occupation data" />;
  }

  const maxBar = Math.max(...bars.map((b) => b.value), 1);
  const topBar = [...bars].sort((a, b) => b.value - a.value)[0];
  const topPct = total > 0 && topBar ? Math.round((topBar.value / total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">


      <div className="grid min-h-0 flex-1 grid-cols-5 gap-1">
        {bars.map((bar, i) => {
          const heightPct = bar.value === 0 ? 0 : Math.max(8, (bar.value / maxBar) * 100);
          const isLeader = topBar?.label === bar.label && bar.value > 0;
          const stagger = i * (CHART.progress.staggerMs / 1000);
          const percentage = total > 0 ? Math.round((bar.value / total) * 100) : 0;
          const fitsInside = heightPct >= 22;

          return (
            <div
              key={bar.label}
              className={`flex min-h-0 flex-col items-center gap-0.5 rounded-md px-0.5 pt-1 ${
                isLeader ? "bg-emerald-50/60 dark:bg-emerald-500/[0.06]" : ""
              }`}
              title={`${bar.label}: ${bar.value.toLocaleString()} (${percentage}%)`}
            >
              <span className="text-[10px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {bar.value > 0 ? bar.value.toLocaleString() : "0"}
              </span>

              <div className="flex w-full min-h-0 flex-1 items-end">
                <div className="relative h-full w-full overflow-hidden rounded-t-md bg-slate-100/90 dark:bg-slate-800/70">
                  {!fitsInside && percentage > 0 ? (
                    <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 text-[9px] font-bold text-slate-700 dark:text-slate-200 [text-shadow:0_0_2px_#fff,0_0_2px_#fff]">
                      {percentage}%
                    </span>
                  ) : null}
                  <motion.div
                    initial={{ height: reduced ? `${heightPct}%` : 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{
                      delay: reduced ? 0 : stagger,
                      duration: reduced ? 0 : CHART.progress.duration,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="absolute bottom-0 left-0 right-0 flex items-start justify-center rounded-t-md pt-1"
                    style={{
                      background: `linear-gradient(180deg, ${bar.color}, ${bar.color}bb)`,
                    }}
                  >
                    {fitsInside && percentage > 0 ? (
                      <span className="pointer-events-none text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                        {percentage}%
                      </span>
                    ) : null}
                  </motion.div>
                </div>
              </div>

              <span
                className="max-w-full truncate text-center text-[10px] font-semibold leading-none"
                style={{ color: bar.color }}
              >
                {bar.short}
              </span>
            </div>
          );
        })}
      </div>

     
    </div>
  );
}
