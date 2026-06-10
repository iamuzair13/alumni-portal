"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, Building2, CalendarRange, Clock, Filter } from "lucide-react";
import {
  MONTH_OPTIONS,
  buildYearOptions,
  defaultDateRange,
  normalizeDateRange,
  toISODateString,
  type AnalyticsPeriodFilter,
} from "@/components/analytics/v2/utils/periodFilter";
import { useRelativeTime } from "./hooks/useRelativeTime";
import {
  ccDateInput,
  ccFilterLabel,
  ccHeaderShell,
  ccPresetChip,
  ccPresetChipActive,
  ccSelect,
} from "./theme";

type RangePreset = {
  id: string;
  label: string;
  getRange: () => { dateFrom: string; dateTo: string };
};

const RANGE_PRESETS: RangePreset[] = [
  {
    id: "7d",
    label: "7d",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { dateFrom: toISODateString(from), dateTo: toISODateString(to) };
    },
  },
  {
    id: "30d",
    label: "30d",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { dateFrom: toISODateString(from), dateTo: toISODateString(to) };
    },
  },
  {
    id: "mtd",
    label: "MTD",
    getRange: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), to.getMonth(), 1);
      return { dateFrom: toISODateString(from), dateTo: toISODateString(to) };
    },
  },
  {
    id: "qtd",
    label: "QTD",
    getRange: () => {
      const to = new Date();
      const qStartMonth = Math.floor(to.getMonth() / 3) * 3;
      const from = new Date(to.getFullYear(), qStartMonth, 1);
      return { dateFrom: toISODateString(from), dateTo: toISODateString(to) };
    },
  },
  {
    id: "ytd",
    label: "YTD",
    getRange: () => {
      const to = new Date();
      const from = new Date(to.getFullYear(), 0, 1);
      return { dateFrom: toISODateString(from), dateTo: toISODateString(to) };
    },
  },
];

function FilterField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={`flex items-center gap-1 ${ccFilterLabel}`}>
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

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

  const activePresetId = useMemo(() => {
    if (periodFilter.periodType !== "range") return null;
    const { dateFrom, dateTo } = normalizeDateRange(periodFilter.dateFrom, periodFilter.dateTo);
    return (
      RANGE_PRESETS.find((p) => {
        const r = p.getRange();
        return r.dateFrom === dateFrom && r.dateTo === dateTo;
      })?.id ?? null
    );
  }, [periodFilter.periodType, periodFilter.dateFrom, periodFilter.dateTo]);

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

  const setPeriodType = (periodType: AnalyticsPeriodFilter["periodType"]) => {
    if (periodType === "range") {
      const range = defaultDateRange();
      onPeriodFilterChange({
        ...periodFilter,
        periodType,
        dateFrom: periodFilter.dateFrom || range.dateFrom,
        dateTo: periodFilter.dateTo || range.dateTo,
      });
      return;
    }
    onPeriodFilterChange({ ...periodFilter, periodType });
  };

  const setDateRange = (partial: { dateFrom?: string; dateTo?: string }) => {
    const next = normalizeDateRange(
      partial.dateFrom ?? periodFilter.dateFrom,
      partial.dateTo ?? periodFilter.dateTo
    );
    onPeriodFilterChange({ ...periodFilter, periodType: "range", ...next });
  };

  const applyPreset = (preset: RangePreset) => {
    const range = preset.getRange();
    onPeriodFilterChange({ ...periodFilter, periodType: "range", ...range });
  };

  return (
    <header className="relative z-30 shrink-0 pb-2.5">
      <div className={`${ccHeaderShell} flex flex-col gap-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Filter className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">Command filters</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Alumni metrics use <code className="text-[10px]">todaydate</code> · events/jobs use their own timestamps
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-2 py-0.5 dark:border-gray-700 dark:bg-gray-800/60">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                aria-hidden
              />
              <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Live
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {clock}
            </span>
            <span>Updated {lastUpdated}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-wrap items-end gap-2">
            <FilterField label="Faculty" icon={<Building2 className="h-2.5 w-2.5" aria-hidden />}>
              <select
                className={`${ccSelect} min-w-[148px]`}
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
            </FilterField>

            <FilterField label="Period" icon={<CalendarRange className="h-2.5 w-2.5" aria-hidden />}>
              <select
                className={`${ccSelect} min-w-[120px]`}
                value={periodFilter.periodType}
                onChange={(e) => setPeriodType(e.target.value as AnalyticsPeriodFilter["periodType"])}
                aria-label="Period type"
              >
                <option value="all">All time</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="range">Date range</option>
              </select>
            </FilterField>

            {periodFilter.periodType === "year" || periodFilter.periodType === "month" ? (
              <FilterField label="Year" icon={<CalendarRange className="h-2.5 w-2.5" aria-hidden />}>
                <select
                  className={`${ccSelect} min-w-[88px]`}
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
              </FilterField>
            ) : null}

            {periodFilter.periodType === "month" ? (
              <FilterField label="Month" icon={<CalendarRange className="h-2.5 w-2.5" aria-hidden />}>
                <select
                  className={`${ccSelect} min-w-[120px]`}
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
              </FilterField>
            ) : null}

            {periodFilter.periodType === "range" ? (
              <>
                <FilterField label="From" icon={<CalendarRange className="h-2.5 w-2.5" aria-hidden />}>
                  <input
                    type="date"
                    className={ccDateInput}
                    value={periodFilter.dateFrom}
                    max={periodFilter.dateTo || undefined}
                    onChange={(e) => setDateRange({ dateFrom: e.target.value })}
                    aria-label="Date range start"
                  />
                </FilterField>
                <FilterField label="To" icon={<CalendarRange className="h-2.5 w-2.5" aria-hidden />}>
                  <input
                    type="date"
                    className={ccDateInput}
                    value={periodFilter.dateTo}
                    min={periodFilter.dateFrom || undefined}
                    onChange={(e) => setDateRange({ dateTo: e.target.value })}
                    aria-label="Date range end"
                  />
                </FilterField>
                <div className="flex flex-wrap items-center gap-1 pb-0.5">
                  {RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`${ccPresetChip} ${activePresetId === preset.id ? ccPresetChipActive : ""}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="relative z-30 w-full shrink-0 sm:w-auto sm:min-w-[200px] sm:max-w-[240px]">
            {performance}
          </div>
        </div>
      </div>
    </header>
  );
}
