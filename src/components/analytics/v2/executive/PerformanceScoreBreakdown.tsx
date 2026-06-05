"use client";

import React from "react";
import type { PerformanceResult } from "../utils/derivePerformanceScore";
import { motion } from "framer-motion";

function factorBarColor(score: number) {
  if (score >= 65) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 45) return "bg-amber-500 dark:bg-amber-400";
  return "bg-rose-500 dark:bg-rose-400";
}

export function PerformanceScoreBreakdown({ result }: { result: PerformanceResult }) {
  const isConcern = result.label === "Needs Attention";
  const accentBorder = isConcern
    ? "border-rose-200/80 dark:border-rose-900/40"
    : result.label === "Strong"
      ? "border-emerald-200/80 dark:border-emerald-900/40"
      : "border-amber-200/80 dark:border-amber-900/40";
  const dotClass = isConcern ? "bg-rose-500" : result.label === "Strong" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-xl border bg-white/90 px-2.5  py-2 shadow-sm backdrop-blur-sm dark:bg-gray-900/60 ${accentBorder}`}
      role="region"
      aria-label="Performance score breakdown"
    >
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {result.headline}
      </p>
      <ul className="mb-2.5 space-y-1.5">
        {result.reasons.map((reason) => (
          <li key={reason} className="flex gap-1.5">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <p className="text-[10px] leading-snug text-gray-700 dark:text-gray-300">{reason}</p>
          </li>
        ))}
      </ul>

      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Score drivers</p>
      <ul className="space-y-1.5">
        {result.factors.map((factor) => (
          <li key={factor.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-medium text-gray-700 dark:text-gray-300">{factor.label}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                {Math.round(factor.score)} · {factor.weight}
              </span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full transition-all ${factorBarColor(factor.score)}`}
                style={{ width: `${factor.score}%` }}
              />
            </div>
            <p className="mt-0.5 truncate text-[9px] text-gray-400 dark:text-gray-500">{factor.detail}</p>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
