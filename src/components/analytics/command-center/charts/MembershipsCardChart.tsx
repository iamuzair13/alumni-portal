"use client";

import React from "react";
import { motion } from "motion/react";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";
import { ChartEmpty } from "./ChartEmpty";

type MembershipRow = {
  label: string;
  short: string;
  approved: number;
  applied: number;
  color: string;
};

function MembershipBarRow({
  row,
  maxApplied,
  isLeader,
  index,
  reduced,
}: {
  row: MembershipRow;
  maxApplied: number;
  isLeader: boolean;
  index: number;
  reduced: boolean;
}) {
  const width = row.applied === 0 ? 0 : Math.max(6, (row.applied / maxApplied) * 100);
  const approvedWidth =
    row.applied === 0 ? 0 : Math.max(row.approved > 0 ? 6 : 0, (row.approved / maxApplied) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-[2.5rem_minmax(0,1fr)_2.75rem] items-center gap-1 rounded-md px-0.5 ${
        isLeader && row.approved > 0 ? "bg-violet-50/60 dark:bg-violet-500/[0.06]" : ""
      }`}
    >
      <span
        className="truncate text-[10px] font-semibold leading-none"
        style={{ color: row.color }}
        title={row.label}
      >
        {row.short}
      </span>

      <div className="relative h-2 min-w-0 overflow-hidden rounded-full bg-slate-100/90 dark:bg-slate-800/70">
        <motion.div
          initial={{ width: reduced ? `${width}%` : 0 }}
          animate={{ width: `${width}%` }}
          transition={{
            delay: reduced ? 0 : stagger,
            duration: reduced ? 0 : CHART.progress.duration,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute inset-y-0 left-0 rounded-full opacity-35"
          style={{ background: row.color }}
        />
        <motion.div
          initial={{ width: reduced ? `${approvedWidth}%` : 0 }}
          animate={{ width: `${approvedWidth}%` }}
          transition={{
            delay: reduced ? 0 : stagger + 0.04,
            duration: reduced ? 0 : CHART.progress.duration,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${row.color}, ${row.color}cc)`,
          }}
        />
      </div>

      <div className="text-right leading-none">
        <p className="text-[10px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {row.approved.toLocaleString()}
        </p>
        <p className="mt-0.5 text-[9px] tabular-nums text-slate-400 dark:text-slate-500">
          /{row.applied.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function MembershipsCardChart({
  gymApproved,
  gymApplied,
  poolApproved,
  poolApplied,
  qalanderApproved,
  qalanderApplied,
}: {
  gymApproved: number;
  gymApplied: number;
  poolApproved: number;
  poolApplied: number;
  qalanderApproved: number;
  qalanderApplied: number;
}) {
  const reduced = useReducedMotion();

  const rows: MembershipRow[] = [
    {
      label: "Gym",
      short: "Gym",
      approved: gymApproved,
      applied: gymApplied,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Pool",
      short: "Pool",
      approved: poolApproved,
      applied: poolApplied,
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Qalandars club",
      short: "Qalandar",
      approved: qalanderApproved,
      applied: qalanderApplied,
      color: KPI_COLOR_HEX.amber,
    },
  ];

  const totalApproved = gymApproved + poolApproved + qalanderApproved;
  const totalApplied = gymApplied + poolApplied + qalanderApplied;

  if (totalApproved === 0 && totalApplied === 0) {
    return <ChartEmpty height={100} variant="premium" message="No memberships yet" />;
  }

  const maxApplied = Math.max(...rows.map((r) => r.applied), 1);
  const topRow = [...rows].sort((a, b) => b.approved - a.approved)[0];
  const topPct = totalApproved > 0 && topRow ? Math.round((topRow.approved / totalApproved) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-1">
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-0.5">
        {rows.map((row, i) => (
          <MembershipBarRow
            key={row.label}
            row={row}
            maxApplied={maxApplied}
            isLeader={topRow?.label === row.label}
            index={i}
            reduced={reduced}
          />
        ))}
      </div>
      {topRow && topRow.approved > 0 ? (
        <p className="shrink-0 truncate text-center text-[11px] font-medium text-violet-600/90 dark:text-violet-400/90">
          <span className="font-bold tabular-nums">{topPct}%</span>
          {" · "}
          {topRow.label} approved
          <span className="text-slate-400 dark:text-slate-500"> · /applied</span>
        </p>
      ) : (
        <p className="shrink-0 text-center text-[8px] leading-tight text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-violet-600 dark:text-violet-400">Approved</span>
          <span className="text-slate-400 dark:text-slate-500"> · /applied</span>
        </p>
      )}
    </div>
  );
}
