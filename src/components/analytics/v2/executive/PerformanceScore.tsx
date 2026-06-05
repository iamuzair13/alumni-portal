"use client";

import React, { useState } from "react";
import type { PerformanceResult } from "../utils/derivePerformanceScore";
import { PerformanceScoreBreakdown } from "./PerformanceScoreBreakdown";

export function PerformanceScore({ result, compact = false }: { result: PerformanceResult; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { score, label } = result;
  const size = compact ? 64 : 88;
  const radius = compact ? 26 : 36;
  const stroke = compact ? 5 : 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  const labelColor =
    label === "Strong"
      ? "text-emerald-600 dark:text-emerald-400"
      : label === "Stable"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  const gauge = (
    <div className={`relative shrink-0 ${compact ? "h-16 w-16" : "h-[88px] w-[88px]"}`}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-100 dark:text-gray-800"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-violet-500 transition-all duration-700 dark:text-violet-400"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold tabular-nums text-gray-900 dark:text-white ${compact ? "text-lg" : "text-xl"}`}>
          {score}
        </span>
      </div>
    </div>
  );

  const cardBody = compact ? (
    <>
      {gauge}
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Portal Performance</p>
        <p className={`text-sm font-bold leading-tight ${labelColor}`}>{label}</p>
        <p className="mt-0.5 text-[9px] text-gray-400 dark:text-gray-500">
          {expanded ? "Tap to hide breakdown" : "Tap for score breakdown"}
        </p>
      </div>
      <svg
        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </>
  ) : (
    <>
      {gauge}
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Portal Performance</p>
        <p className={`text-sm font-bold ${labelColor}`}>{label}</p>
        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          Composite index from verification, engagement, placement & chapters ·{" "}
          {expanded ? "click to hide" : "click for breakdown"}
        </p>
      </div>
      <svg
        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls="performance-score-breakdown"
        className={`flex w-full items-center gap-2.5 rounded-xl border border-gray-200/60 bg-white/80 text-left shadow-sm backdrop-blur-sm transition-colors hover:border-indigo-300/60 hover:bg-white dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-indigo-500/40 dark:hover:bg-gray-900/70 ${
          compact ? "px-2.5 py-2" : "gap-3 p-3"
        } ${expanded ? "ring-2 ring-indigo-500/20 dark:ring-indigo-400/20" : ""}`}
      >
        {cardBody}
      </button>

      {expanded ? (
        <div id="performance-score-breakdown">
          <PerformanceScoreBreakdown result={result} />
        </div>
      ) : null}
    </div>
  );
}
