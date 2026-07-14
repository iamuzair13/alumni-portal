"use client";

import React from "react";
import { motion } from "motion/react";
import type { EngagementActivityRow } from "../data/mapPayloadToCards";
import { SimpleBarList } from "./SimpleBarList";

const ACTIVITY_COLORS = [
  "#6366F1",
  "#14B8A6",
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#0EA5E9",
] as const;

function FlatSparkline() {
  const points = Array.from({ length: 12 }, (_, i) => `${i * 20},32`);
  return (
    <svg
      viewBox="0 0 220 40"
      className="w-full"
      style={{ height: 32 }}
      aria-hidden
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#CBD5E1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 3"
      />
      {points.map((p, i) => {
        const [x] = p.split(",");
        return (
          <circle key={i} cx={Number(x)} cy={32} r={2.5} fill="#E2E8F0" />
        );
      })}
    </svg>
  );
}

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
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center"
      >
        <FlatSparkline />
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
          No activities yet
        </p>
        <p className="text-[10px] text-slate-300 dark:text-slate-600">
          Start an activity to see data here
        </p>
      </motion.div>
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
      ? `${row.quarter.toLocaleString()} last 3 months`
      : `${row.ytd.toLocaleString()} year to date`,
    value: useYtd ? row.ytd : row.quarter,
    color: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length],
  }));

  return (
    <SimpleBarList items={bars} compact={total > 0 && bars.length > 4} />
  );
}
