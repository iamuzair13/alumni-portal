"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Activity, Clock } from "lucide-react";
import {
  MONTH_OPTIONS,
  buildYearOptions,
  type AnalyticsPeriodFilter,
} from "@/components/analytics/v2/utils/periodFilter";
import { useRelativeTime } from "./hooks/useRelativeTime";
import { ccHeaderBorder, ccSelect } from "./theme";

export function CommandCenterHeader({
  facultyFilter,
  onFacultyChange,
  facultyOptions,
  isLoadingFaculties,
  periodFilter,
  onPeriodFilterChange,
  dataUpdatedAt,
  performance,
}: {
  facultyFilter: string;
  onFacultyChange: (v: string) => void;
  facultyOptions: Array<{ id: number; faculty_name: string }>;
  isLoadingFaculties: boolean;
  periodFilter: AnalyticsPeriodFilter;
  onPeriodFilterChange: (f: AnalyticsPeriodFilter) => void;
  dataUpdatedAt: number;
  performance: React.ReactNode;
}) {
  const [clock, setClock] = useState("");
  const lastUpdated = useRelativeTime(dataUpdatedAt);
  const yearOptions = buildYearOptions(12);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className={`flex shrink-0 flex-wrap items-center gap-2.5 pb-2.5 ${ccHeaderBorder}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-emerald-600 shadow-sm">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-gray-900 dark:text-white sm:text-lg">
            Analytics Command Center
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <motion.span
                className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              System Live · Real-time
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Clock className="h-3 w-3" />
              {clock}
            </span>
            <span>· Updated {lastUpdated}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={ccSelect}
          value={facultyFilter}
          onChange={(e) => onFacultyChange(e.target.value)}
          disabled={isLoadingFaculties}
          aria-label="Faculty filter"
        >
          <option value="all">All faculties</option>
          {facultyOptions.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.faculty_name}
            </option>
          ))}
        </select>

        <select
          className={ccSelect}
          value={periodFilter.periodType}
          onChange={(e) =>
            onPeriodFilterChange({
              ...periodFilter,
              periodType: e.target.value as AnalyticsPeriodFilter["periodType"],
            })
          }
          aria-label="Period type"
        >
          <option value="all">All time</option>
          <option value="year">Year</option>
          <option value="month">Month</option>
        </select>

        {periodFilter.periodType !== "all" ? (
          <select
            className={ccSelect}
            value={periodFilter.year}
            onChange={(e) => onPeriodFilterChange({ ...periodFilter, year: Number(e.target.value) })}
            aria-label="Year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : null}

        {periodFilter.periodType === "month" ? (
          <select
            className={ccSelect}
            value={periodFilter.month}
            onChange={(e) => onPeriodFilterChange({ ...periodFilter, month: Number(e.target.value) })}
            aria-label="Month"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="relative w-full shrink-0 sm:w-auto sm:min-w-[200px] sm:max-w-[240px]">
        {performance}
      </div>
    </header>
  );
}
