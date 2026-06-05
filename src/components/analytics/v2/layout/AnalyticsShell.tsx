"use client";

import React from "react";
import { DashboardIcons } from "@/components/analytics/management/DashboardPrimitives";
import {
  type AnalyticsPeriodFilter,
  MONTH_OPTIONS,
  buildYearOptions,
} from "@/components/analytics/v2/utils/periodFilter";

const toc = [
  { id: "#section-a", label: "Alumni" },
  { id: "#section-b", label: "Engagement" },
  { id: "#section-c", label: "Development" },
  { id: "#section-d", label: "Perks" },
] as const;

const selectClass =
  "w-full appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-xs font-medium text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200";

export function AnalyticsShell({
  children,
  facultyFilter,
  onFacultyChange,
  facultyOptions,
  isLoadingFaculties,
  periodFilter,
  onPeriodFilterChange,
}: {
  children: React.ReactNode;
  facultyFilter: string;
  onFacultyChange: (v: string) => void;
  facultyOptions: Array<{ id: number; faculty_name: string }>;
  isLoadingFaculties: boolean;
  periodFilter: AnalyticsPeriodFilter;
  onPeriodFilterChange: (filter: AnalyticsPeriodFilter) => void;
}) {
  const yearOptions = buildYearOptions(12);

  const setPeriodType = (periodType: AnalyticsPeriodFilter["periodType"]) => {
    onPeriodFilterChange({ ...periodFilter, periodType });
  };

  const setYear = (year: number) => {
    onPeriodFilterChange({ ...periodFilter, year });
  };

  const setMonth = (month: number) => {
    onPeriodFilterChange({ ...periodFilter, month });
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-3 dark:bg-gray-950 md:p-5">
      <header className="mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            {DashboardIcons.chart}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white sm:text-xl">
              Alumni Intelligence Platform
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Real-time analytics — filters apply to alumni-linked metrics
            </p>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 -mx-3 mb-3 border-b border-gray-200/80 bg-gray-50/95 px-3 py-2 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90 md:-mx-5 md:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Dashboard sections">
            {toc.map((t) => (
              <a
                key={t.id}
                href={t.id}
                className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[140px] flex-1 sm:flex-none">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                {DashboardIcons.filter}
              </div>
              <select
                value={facultyFilter}
                onChange={(e) => onFacultyChange(e.target.value)}
                disabled={isLoadingFaculties}
                aria-label="Faculty filter"
                className={`${selectClass} min-w-[160px]`}
              >
                <option value="all">All Faculties</option>
                {facultyOptions.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.faculty_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[100px] flex-1 sm:flex-none sm:min-w-[110px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                {DashboardIcons.calendar}
              </div>
              <select
                value={periodFilter.periodType}
                onChange={(e) => setPeriodType(e.target.value as AnalyticsPeriodFilter["periodType"])}
                aria-label="Period type"
                className={selectClass}
              >
                <option value="all">All</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
              </select>
            </div>

            {periodFilter.periodType !== "all" ? (
              <div className="relative min-w-[90px] flex-1 sm:flex-none sm:min-w-[100px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                  {DashboardIcons.calendar}
                </div>
                <select
                  value={periodFilter.year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  aria-label="Year"
                  className={selectClass}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {periodFilter.periodType === "month" ? (
              <div className="relative min-w-[120px] flex-1 sm:flex-none sm:min-w-[130px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                  {DashboardIcons.calendar}
                </div>
                <select
                  value={periodFilter.month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  aria-label="Month"
                  className={selectClass}
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
