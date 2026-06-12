"use client";

import React from "react";
import { motion } from "motion/react";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

function MetricTile({
  label,
  value,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  accent: "emerald" | "sky" | "violet" | "amber";
  delay?: number;
}) {
  const styles = {
    emerald: {
      border: "border-emerald-200/70 dark:border-emerald-500/20",
      bg: "from-emerald-50/90 to-white dark:from-emerald-500/10 dark:to-gray-900/40",
      label: "text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-300",
    },
    sky: {
      border: "border-sky-200/70 dark:border-sky-500/20",
      bg: "from-sky-50/90 to-white dark:from-sky-500/10 dark:to-gray-900/40",
      label: "text-sky-600 dark:text-sky-400",
      value: "text-sky-700 dark:text-sky-300",
    },
    violet: {
      border: "border-violet-200/70 dark:border-violet-500/20",
      bg: "from-violet-50/90 to-white dark:from-violet-500/10 dark:to-gray-900/40",
      label: "text-violet-600 dark:text-violet-400",
      value: "text-violet-700 dark:text-violet-300",
    },
    amber: {
      border: "border-amber-200/70 dark:border-amber-500/20",
      bg: "from-amber-50/90 to-white dark:from-amber-500/10 dark:to-gray-900/40",
      label: "text-amber-600 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-300",
    },
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex min-h-0 flex-col justify-center rounded-lg border bg-gradient-to-br px-2 py-1.5 ${styles.border} ${styles.bg}`}
    >
      <p className={`text-[8px] font-semibold uppercase tracking-wider ${styles.label}`}>{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums leading-none ${styles.value}`}>
        {value.toLocaleString()}
      </p>
    </motion.div>
  );
}

export function VelocityCardChart({
  trackedTotal,
  beforeGraduation,
  earlyCount,
  score,
  timingBars,
}: {
  trackedTotal: number;
  beforeGraduation: number;
  earlyCount: number;
  score: number;
  timingBars: Array<{ label: string; value: number; color: string }>;
}) {
  const reduced = useReducedMotion();

  if (trackedTotal === 0 && beforeGraduation === 0 && earlyCount === 0) {
    return <ChartEmpty height={88} message="No transition timing data" />;
  }

  const maxBar = Math.max(...timingBars.map((b) => b.value), 1);

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        <MetricTile label="Tracked" value={trackedTotal} accent="emerald" delay={0.05} />
        <MetricTile label="During grad" value={beforeGraduation} accent="sky" delay={0.1} />
        <MetricTile label="Early" value={earlyCount} accent="violet" delay={0.14} />
      </div>

      {timingBars.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
          {timingBars.slice(0, 3).map((bar, i) => {
            const width = Math.max(8, (bar.value / maxBar) * 100);
            return (
              <motion.div
                key={bar.label}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + i * 0.06, duration: 0.35 }}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)_1.75rem] items-center gap-1"
              >
                <span className="truncate text-right text-[8px] font-medium text-slate-500 dark:text-slate-400">
                  {bar.label}
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                  <motion.div
                    initial={{ width: reduced ? `${width}%` : 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{
                      delay: reduced ? 0 : i * (CHART.progress.staggerMs / 1000),
                      duration: reduced ? 0 : CHART.progress.duration,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: bar.color }}
                  />
                </div>
                <span className="text-right text-[8px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {bar.value.toLocaleString()}
                </span>
              </motion.div>
            );
          })}
        </div>
      ) : null}

      <p className="shrink-0 text-center text-[8px] font-medium text-emerald-600/90 dark:text-emerald-400/90">
        {score}% early transition rate
      </p>
    </div>
  );
}
