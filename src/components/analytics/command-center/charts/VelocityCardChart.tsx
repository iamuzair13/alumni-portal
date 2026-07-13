"use client";

import React from "react";
import { motion } from "motion/react";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

export function VelocityCardChart({
  rows,
  total,
}: {
  rows: Array<{ label: string; short: string; count: number; color: string }>;
  total: number;
}) {
  const reduced = useReducedMotion();

  if (total === 0 && rows.every((r) => r.count === 0)) {
    return <ChartEmpty height={88} message="No transition timing data" />;
  }

  const maxBar = Math.max(...rows.map((r) => r.count), 1);
  const topRow = [...rows].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-6 gap-0.5">
        {rows.map((bar, i) => {
          const heightPct = bar.count === 0 ? 0 : Math.max(10, (bar.count / maxBar) * 100);
          const isLeader = topRow?.label === bar.label && bar.count > 0;
          const stagger = i * (CHART.progress.staggerMs / 1000);
          const percentage = total > 0 ? Math.round((bar.count / total) * 100) : 0;
          const fitsInside = heightPct >= 22;

          return (
            <div
              key={bar.label}
              className={`flex min-h-0 flex-col items-center rounded-lg px-0.5 pb-0.5 pt-1 ${
                isLeader
                  ? "bg-gradient-to-b from-emerald-50/80 to-transparent dark:from-emerald-500/[0.08] dark:to-transparent"
                  : ""
              }`}
              title={`${bar.label}: ${bar.count.toLocaleString()} (${percentage}%)`}
            >
              <span
                className={`mb-0.5 text-[10px] font-semibold tabular-nums leading-none ${
                  bar.count > 0
                    ? "text-slate-800 dark:text-slate-100"
                    : "text-slate-300 dark:text-slate-600"
                }`}
              >
                {bar.count.toLocaleString()}
              </span>

              <div className="flex w-full min-h-0 flex-1 items-end">
                <div className="relative h-full w-full overflow-hidden rounded-md bg-slate-100/80 ring-1 ring-inset ring-slate-200/60 dark:bg-slate-800/50 dark:ring-slate-700/50">
                  {bar.count > 0 ? (
                    <>
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
                        className="absolute bottom-0 left-0 right-0 flex items-start justify-center rounded-md pt-1"
                        style={{
                          background: `linear-gradient(180deg, ${bar.color}ee, ${bar.color}99)`,
                          boxShadow: isLeader ? `0 0 12px ${bar.color}40` : undefined,
                        }}
                      >
                        {fitsInside && percentage > 0 ? (
                          <span className="pointer-events-none text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                            {percentage}%
                          </span>
                        ) : null}
                      </motion.div>
                    </>
                  ) : (
                    <div className="absolute bottom-0 left-1/2 h-0.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
                  )}
                </div>
              </div>

              <span
                className={`mt-1 max-w-full truncate text-center text-[10px] font-medium leading-none ${
                  bar.count > 0 ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"
                }`}
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
