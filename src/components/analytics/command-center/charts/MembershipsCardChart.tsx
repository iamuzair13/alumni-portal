"use client";

import React from "react";
import { motion } from "motion/react";

type MembershipRow = {
  label: string;
  approved: number;
  applied: number;
  gradient: string;
};

const ROWS_META = [
  { key: "gym",     label: "Gym",           gradient: "from-indigo-500 to-purple-500" },
  { key: "pool",    label: "Swimming Pool",  gradient: "from-sky-400 to-cyan-500" },
  { key: "qalander",label: "Qalandars Club", gradient: "from-amber-400 to-orange-500" },
] as const;

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
  const rows: MembershipRow[] = [
    { label: "Gym",           approved: gymApproved,      applied: gymApplied,      gradient: ROWS_META[0].gradient },
    { label: "Swimming Pool",  approved: poolApproved,     applied: poolApplied,     gradient: ROWS_META[1].gradient },
    { label: "Qalandars Club", approved: qalanderApproved, applied: qalanderApplied, gradient: ROWS_META[2].gradient },
  ];

  const totalApproved = gymApproved + poolApproved + qalanderApproved;
  const totalApplied  = gymApplied  + poolApplied  + qalanderApplied;

  /* ── Empty state: nothing applied at all ── */
  if (totalApplied === 0) {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          No applications received yet
        </p>
      </div>
    );
  }

  /* ── Data state: progress bars (approved / applied) ── */
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2.5">
      {totalApproved === 0 && (
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          No memberships approved yet
        </p>
      )}
      {rows.map((row) => {
        const hasApplied = row.applied > 0;
        const approvedPct = hasApplied ? (row.approved / row.applied) * 100 : 0;
        return (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {row.label}
              </span>
              

              <span className="text-[11px] font-bold tabular-nums text-slate-900 dark:text-white">
                {row.approved}
                {hasApplied && (
                  <span className="font-normal text-slate-400"> / {row.applied}</span>
                )}
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${approvedPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${row.gradient}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
