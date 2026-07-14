"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

type StatGroup = {
  total: number;
  quarter: number;
};

const EVENTS_COLOR = "#6366F1";
const MEETUPS_COLOR = "#14B8A6";

function VerticalBar({
  label,
  total,
  quarter,
  color,
  maxVal,
  delay,
}: {
  label: string;
  total: number;
  quarter: number;
  color: string;
  maxVal: number;
  delay: number;
}) {
  const heightPct = maxVal > 0 ? Math.max(6, (total / maxVal) * 100) : 6;
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      {/* Value label on top */}
      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{total}</span>

      {/* Bar */}
      <div
        className="relative w-10 overflow-hidden rounded-t-lg bg-slate-100 dark:bg-slate-800"
        style={{ height: 64 }}
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${heightPct}%` }}
          transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-0 left-0 w-full rounded-t-lg"
          style={{ background: `linear-gradient(180deg, ${color}cc, ${color})` }}
        />
      </div>

      {/* Label */}
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>

      {/* Quarter badge */}
      <span
        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
        style={{
          backgroundColor: `${color}18`,
          color,
        }}
      >
        {quarter} L3M
      </span>
    </div>
  );
}

export function MeetupsEventsCardChart({
  events,
  meetups,
}: {
  events: StatGroup;
  meetups: StatGroup;
}) {
  const hasData =
    events.total > 0 || events.quarter > 0 || meetups.total > 0 || meetups.quarter > 0;
  if (!hasData) return <ChartEmpty height={88} variant="premium" />;

  const maxVal = Math.max(events.total, meetups.total, 1);

  return (
    <div className="flex h-full min-h-0 w-full items-end justify-center gap-6 pb-1">
      <VerticalBar
        label="Events"
        total={events.total}
        quarter={events.quarter}
        color={EVENTS_COLOR}
        maxVal={maxVal}
        delay={0}
      />
      <div className="mb-8 h-px w-px self-stretch border-l border-dashed border-slate-200 dark:border-slate-700" />
      <VerticalBar
        label="Meetups"
        total={meetups.total}
        quarter={meetups.quarter}
        color={MEETUPS_COLOR}
        maxVal={maxVal}
        delay={0.1}
      />
    </div>
  );
}
