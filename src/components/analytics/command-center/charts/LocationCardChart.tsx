"use client";

import React from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../animation/useReducedMotion";
import { CHART } from "../animation/config";
import { ChartEmpty } from "./ChartEmpty";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";

// Stable colors for the Pakistan provinces / buckets we already know.
// Any new region returned by the data will fall back to the shared palette.
const REGION_COLOR_MAP: Record<string, string> = {
  Punjab: "#10b981",
  Islamabad: "#14b8a6",
  KPK: "#0ea5e9",
  Sindh: "#6366f1",
  AJK: "#8b5cf6",
  GB: "#64748b",
  Balochistan: "#f59e0b",
  Overseas: "#3b82f6",
  "Not Assigned": "#94a3b8",
  Other: "#94a3b8",
  Others: "#94a3b8",
  NULL: "#94a3b8",
};

function RegionBarRow({
  bar,
  maxBar,
  isLeader,
  index,
  reduced,
  total,
}: {
  bar: { label: string; count: number; color: string };
  maxBar: number;
  isLeader: boolean;
  index: number;
  reduced: boolean;
  total: number;
}) {
  const width = bar.count === 0 ? 0 : Math.max(6, (bar.count / maxBar) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);
  const percentage = total > 0 ? Math.round((bar.count / total) * 100) : 0;

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        isLeader && bar.count > 0
          ? "bg-emerald-50/80 dark:bg-emerald-500/[0.08]"
          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
      }`}
      title={`${bar.label}: ${bar.count.toLocaleString()} (${percentage}%)`}
    >
      {/* Bar track */}
      <div className="relative flex-1 min-w-0 h-8 rounded-lg overflow-hidden bg-slate-100/90 dark:bg-slate-800/70">
        {/* Animated bar fill */}
        <motion.div
          initial={{ width: reduced ? `${width}%` : 0 }}
          animate={{ width: `${width}%` }}
          transition={{
            delay: reduced ? 0 : stagger,
            duration: reduced ? 0 : CHART.progress.duration,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute inset-y-0 left-0 rounded-lg flex items-center"
          style={{
            background: `linear-gradient(135deg, ${bar.color}, ${bar.color}dd)`,
            boxShadow: `0 2px 8px ${bar.color}40`,
          }}
        >
          {/* Label + count inside the bar */}
          {width > 25 && (
            <motion.span
              initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: reduced ? 0 : stagger + 0.2,
                duration: 0.4,
                ease: "easeOut",
              }}
              className="ml-2.5 text-[11px] font-semibold text-white whitespace-nowrap drop-shadow-sm"
            >
              {bar.label} ({bar.count.toLocaleString()})
            </motion.span>
          )}
        </motion.div>

        {/* Label outside bar when bar is too short */}
        {width <= 25 && bar.count > 0 && (
          <motion.span
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay: reduced ? 0 : stagger + 0.3,
              duration: 0.4,
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 ml-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
          >
            {bar.label} ({bar.count.toLocaleString()})
          </motion.span>
        )}
      </div>

      {/* Percentage */}
      <span className="shrink-0 w-10 text-right text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-300">
        {percentage}%
      </span>
    </div>
  );
}

export function LocationCardChart({
  rows,
  total,
  maxItems = 5,
}: {
  rows: Array<{ region: string; count: number }>;
  total: number;
  maxItems?: number;
}) {
  const reduced = useReducedMotion();

  // Build bars from the actual distinct regions in the data.
  // Stable colors are used for known regions; anything new falls back to the palette.
  const allBars = rows.map((r, i) => ({
    label: r.region,
    count: r.count,
    color: REGION_COLOR_MAP[r.region] ?? colorAt(i),
  }));

  const topRegion = [...allBars].sort((a, b) => b.count - a.count)[0];
  const bars = [...allBars].sort((a, b) => b.count - a.count).slice(0, maxItems);

  if (total === 0 && allBars.every((b) => b.count === 0)) {
    return <ChartEmpty height={88} message="No location data" />;
  }

  const maxBar = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1 py-1">
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {bars.map((bar, i) => (
          <RegionBarRow
            key={bar.label}
            bar={bar}
            maxBar={maxBar}
            isLeader={topRegion?.label === bar.label && bar.count > 0}
            index={i}
            reduced={reduced}
            total={total}
          />
        ))}
      </div>
    </div>
  );
}