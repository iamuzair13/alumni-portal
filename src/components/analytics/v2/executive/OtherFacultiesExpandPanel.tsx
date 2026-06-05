"use client";

import React from "react";
import { formatKpiValue } from "@/components/analytics/management/dashboardFormat";
import type { KpiFacultyExpandRow } from "../utils/kpiConfig";

export function OtherFacultiesExpandPanel({ faculties }: { faculties: KpiFacultyExpandRow[] }) {
  if (!faculties.length) {
    return <p className="text-[10px] text-gray-400">No additional faculties.</p>;
  }

  return (
    <div
      className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/40"
      role="region"
      aria-label="Other faculties breakdown"
    >
      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Remaining faculties ({faculties.length})
      </p>
      <ul className="max-h-[140px] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
        {faculties.map((row) => (
          <li
            key={`${row.faculty}-${row.facultyId ?? "na"}`}
            className="flex items-center justify-between gap-2 border-b border-slate-100 py-0.5 last:border-0 dark:border-slate-800/60"
          >
            <span className="min-w-0 truncate text-[10px] font-medium text-gray-700 dark:text-gray-300" title={row.faculty}>
              {row.faculty}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
              {row.facultyId != null ? `#${row.facultyId} · ` : ""}
              {formatKpiValue(row.count)} admins
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
