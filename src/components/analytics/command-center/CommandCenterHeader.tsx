"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Building2,
  CalendarRange,
  Clock,
  FlaskConical,
  RotateCcw,
} from "lucide-react";
import {
  MONTH_OPTIONS,
  buildYearOptions,
  defaultDateRange,
  normalizeDateRange,
  toISODateString,
  type AnalyticsPeriodFilter,
} from "@/components/analytics/v2/utils/periodFilter";
import { LivePulse } from "./animation/LivePulse";
import { useAnimationReplay } from "./animation/AnimationReplayContext";
import { useRelativeTime } from "./hooks/useRelativeTime";
import { ccPresetChip, ccPresetChipActive } from "./theme";

const compactSelect =
  "min-w-0 border-0 bg-transparent py-0.5 pl-0 pr-6 text-xs font-medium text-gray-800 focus:outline-none focus:ring-0 dark:text-gray-100";

const compactDate =
  "w-[7.5rem] border-0 bg-transparent py-0.5 text-xs font-medium text-gray-800 focus:outline-none dark:text-gray-100 dark:[color-scheme:dark]";

const controlShell =
  "group/control relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200/80 bg-white/90 px-2 dark:border-gray-700/80 dark:bg-gray-900/80";

const statusShell =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50/80 px-2 text-xs dark:border-gray-700 dark:bg-gray-800/60";

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

function InlineControl({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={controlShell} title={label}>
      <span className="shrink-0 text-gray-400 dark:text-gray-500" aria-hidden>
        {icon}
      </span>
      {children}
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-focus-within/control:rotate-180 dark:text-gray-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clipRule="evenodd"
        />
      </svg>
    </label>
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
  const { replay, demoMode, toggleDemo } = useAnimationReplay();

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
      setClock(now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: false }));
    };
    tick();
    const id = setInterval(tick, 60_000);
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
    <header className="relative z-30 shrink-0 pb-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-gray-200/80 bg-white/80 px-2 py-1.5 shadow-sm backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/60">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <InlineControl icon={<Building2 className="h-3.5 w-3.5" />} label="Faculty">
            <select
              className={`${compactSelect} max-w-[10rem] sm:max-w-[12rem]`}
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
          </InlineControl>

          <InlineControl icon={<CalendarRange className="h-3.5 w-3.5" />} label="Period">
            <select
              className={`${compactSelect} max-w-[6.5rem]`}
              value={periodFilter.periodType}
              onChange={(e) => setPeriodType(e.target.value as AnalyticsPeriodFilter["periodType"])}
              aria-label="Period type"
            >
              <option value="all">All time</option>
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="range">Range</option>
            </select>
          </InlineControl>

          {periodFilter.periodType === "year" || periodFilter.periodType === "month" ? (
            <InlineControl icon={<CalendarRange className="h-3.5 w-3.5" />} label="Year">
              <select
                className={`${compactSelect} max-w-[4rem]`}
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
            </InlineControl>
          ) : null}

          {periodFilter.periodType === "month" ? (
            <InlineControl icon={<CalendarRange className="h-3.5 w-3.5" />} label="Month">
              <select
                className={`${compactSelect} max-w-[5.5rem]`}
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
            </InlineControl>
          ) : null}

          {periodFilter.periodType === "range" ? (
            <>
              <InlineControl icon={<CalendarRange className="h-3.5 w-3.5" />} label="From">
                <input
                  type="date"
                  className={compactDate}
                  value={periodFilter.dateFrom}
                  max={periodFilter.dateTo || undefined}
                  onChange={(e) => setDateRange({ dateFrom: e.target.value })}
                  aria-label="Date range start"
                />
              </InlineControl>
              <InlineControl icon={<CalendarRange className="h-3.5 w-3.5" />} label="To">
                <input
                  type="date"
                  className={compactDate}
                  value={periodFilter.dateTo}
                  min={periodFilter.dateFrom || undefined}
                  onChange={(e) => setDateRange({ dateTo: e.target.value })}
                  aria-label="Date range end"
                />
              </InlineControl>
              <div className="flex flex-wrap items-center gap-0.5">
                {RANGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`${ccPresetChip} !px-2 !py-0.5 text-[10px] ${activePresetId === preset.id ? ccPresetChipActive : ""}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className={statusShell}>
              <LivePulse />
              <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span className="font-semibold">Live</span>
            </span>
            <span className={`${statusShell} hidden sm:inline-flex`} title="Local time">
              <Clock className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              {clock}
            </span>
            {/* <span className={`${statusShell} hidden md:inline-flex font-medium`}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={lastUpdated}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {lastUpdated}
                </motion.span>
              </AnimatePresence>
            </span> */}
            {demoMode ? (
              <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 lg:inline-flex dark:bg-amber-500/15 dark:text-amber-300">
                Demo
              </span>
            ) : null}
            <div className="hidden items-center gap-1 lg:flex">
              <button
                type="button"
                onClick={replay}
                title="Replay animations"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Replay animations"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleDemo}
                title={demoMode ? "Disable demo mode" : "Enable demo mode (simulated metric drift)"}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  demoMode
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`}
                aria-label={demoMode ? "Disable demo mode" : "Enable demo mode"}
                aria-pressed={demoMode}
              >
                <FlaskConical className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="hidden h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
          <div className="shrink-0 sm:min-w-[11.5rem]">{performance}</div>
        </div>
      </div>
    </header>
  );
}
