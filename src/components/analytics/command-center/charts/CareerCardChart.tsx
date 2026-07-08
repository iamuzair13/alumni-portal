"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

const UOL_COLOR = "#6366F1";
const OTHER_COLOR = "#14B8A6";

function JobBar({
  label,
  value,
  maxValue,
  color,
  pct,
  delay,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  pct: string;
  delay: number;
}) {
  const barWidth = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{value.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400">({pct}%)</span>
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}bb)` }}
        />
      </div>
    </div>
  );
}

export function CareerCardChart({
  total,
  uol,
  other,
}: {
  total: number;
  uol: number;
  other: number;
}) {
  if (total === 0 && uol === 0 && other === 0) {
    return <ChartEmpty height={100} variant="premium" message="No jobs posted yet" />;
  }

  const denom = Math.max(uol + other, 1);
  const uolPct = ((uol / denom) * 100).toFixed(1);
  const otherPct = ((other / denom) * 100).toFixed(1);
  const maxVal = Math.max(uol, other, 1);

  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-center gap-3">
      <JobBar label="UOL" value={uol} maxValue={maxVal} color={UOL_COLOR} pct={uolPct} delay={0} />
      <JobBar label="Other" value={other} maxValue={maxVal} color={OTHER_COLOR} pct={otherPct} delay={0.08} />
    </div>
  );
}
