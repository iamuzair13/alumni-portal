"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

export function PublicationsCardChart({
  storiesYtd,
  storiesQuarter,
  newslettersYtd,
  surveys,
}: {
  storiesYtd: number;
  storiesQuarter: number;
  newslettersYtd: number;
  surveys: number;
}) {
  const total = storiesYtd;
  const newsletters = newslettersYtd;
  const other = Math.max(0, total - newsletters);

  if (total === 0 && newsletters === 0 && surveys === 0) {
    return <ChartEmpty height={100} variant="premium" message="No publications yet" />;
  }

  const newsletterPct = total > 0 ? (newsletters / total) * 100 : 0;
  const otherPct = total > 0 ? (other / total) * 100 : 100;

  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-center gap-3">
      {/* Trend badges row */}
      <div className="flex flex-wrap items-center gap-2">
        {newsletters > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            +{newsletters} newsletter{newsletters !== 1 ? "s" : ""}
          </span>
        )}
        {storiesQuarter > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/12 dark:text-indigo-400">
            {storiesQuarter} this qtr
          </span>
        )}
        {surveys > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/12 dark:text-amber-400">
            {surveys} survey{surveys !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Stacked progress bar: newsletters vs other */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${otherPct}%` }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 rounded-l-full"
              style={{ background: "linear-gradient(90deg, #6366F1, #818CF8)" }}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${newsletterPct}%` }}
              transition={{ delay: 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 right-0 rounded-r-full"
              style={{ background: "linear-gradient(90deg, #2DD4BF, #14B8A6)" }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {other} stories
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
              {newsletters} newsletters
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
