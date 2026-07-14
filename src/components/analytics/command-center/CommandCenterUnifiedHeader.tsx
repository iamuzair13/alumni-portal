"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useSession } from "next-auth/react";
import { Building2, CalendarRange, SlidersHorizontal, UserCog, X } from "lucide-react";
import {
  MONTH_OPTIONS,
  buildYearOptions,
  defaultDateRange,
  normalizeDateRange,
  toISODateString,
  type AnalyticsPeriodFilter,
} from "@/components/analytics/v2/utils/periodFilter";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import UserDropdown from "@/components/header/UserDropdown";
import { AnimatedNumber } from "./animation/AnimatedNumber";
import { ExpandDrawer } from "./ExpandDrawer";
import { TrainedAdminsExpandPanel } from "./panels/TrainedAdminsExpandPanel";
import { mapTrainedAdmins } from "./data/mapPayloadToCards";
import { ccAccent, ccPresetChip, ccPresetChipActive } from "./theme";

/* ──────────────────────────────────────────────────────────────
   Design Tokens — unified visual language
   ────────────────────────────────────────────────────────────── */
const tokens = {
  // Heights
  headerHeight: "h-11 lg:h-12 xl:h-14",
  controlHeight: "h-8 xl:h-9",
  
  // Backgrounds
  surface: "bg-white dark:bg-gray-950",
  surfaceElevated: "bg-gray-50/80 dark:bg-gray-900/80",
  surfaceHover: "hover:bg-gray-100/80 dark:hover:bg-gray-800/80",
  
  // Borders
  border: "border-gray-200/60 dark:border-gray-800/60",
  borderAccent: "border-amber-200/60 dark:border-amber-500/20",
  
  // Text
  textPrimary: "text-gray-900 dark:text-gray-100",
  textSecondary: "text-gray-500 dark:text-gray-400",
  textMuted: "text-gray-400 dark:text-gray-500",
  
  // Focus
  focusRing: "focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700",
  
  // Transitions
  transition: "transition-all duration-200 ease-out",
} as const;

/* ──────────────────────────────────────────────────────────────
   Shared Control Component — single source of truth for all
   interactive elements in the header
   ────────────────────────────────────────────────────────────── */
interface ControlProps {
  icon?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  as?: "label" | "button";
}

function Control({
  icon,
  label,
  children,
  className = "",
  onClick,
  active = false,
  as = "label",
}: ControlProps) {
  const base = `
    group inline-flex items-center gap-2
    ${tokens.controlHeight} px-3
    rounded-lg border ${tokens.border}
    ${tokens.surfaceElevated}
    ${tokens.transition}
    ${active ? "bg-gray-100/90 dark:bg-gray-800/90 ring-1 ring-gray-200 dark:ring-gray-700" : tokens.surfaceHover}
    ${tokens.focusRing}
  `;

  if (as === "button") {
    return (
      <button type="button" onClick={onClick} className={`${base} ${className}`} title={label}>
        {icon && <span className={tokens.textMuted}>{icon}</span>}
        {children}
      </button>
    );
  }

  return (
    <label className={`${base} ${className}`} title={label}>
      {icon && <span className={tokens.textMuted}>{icon}</span>}
      {children}
    </label>
  );
}

/* ──────────────────────────────────────────────────────────────
   Select Primitive — clean, native-styled selects
   ────────────────────────────────────────────────────────────── */
function Select({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  className = "",
}: {
  value: string | number;
  onChange: (val: string) => void;
  options: Array<{ value: string | number; label: string }>;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        min-w-0 appearance-none bg-transparent py-0 pl-0 pr-6
        text-xs font-medium ${tokens.textPrimary}
        focus:outline-none cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* ──────────────────────────────────────────────────────────────
   Date Input Primitive
   ────────────────────────────────────────────────────────────── */
function DateInput({
  value,
  onChange,
  min,
  max,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  max?: string;
  ariaLabel: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`
        w-[7.5rem] bg-transparent py-0
        text-xs font-medium ${tokens.textPrimary}
        focus:outline-none
        dark:[color-scheme:dark]
      `}
    />
  );
}

/* ──────────────────────────────────────────────────────────────
   Preset Chips — compact, pill-style range selectors
   ────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   Filter Controls — unified layout, no ghost/inline duality
   ────────────────────────────────────────────────────────────── */
type FilterControlsProps = {
  facultyFilter: string;
  onFacultyChange: (v: string) => void;
  facultyOptions: Array<{ id: number; faculty_name: string }>;
  isLoadingFaculties: boolean;
  periodFilter: AnalyticsPeriodFilter;
  onPeriodFilterChange: (f: AnalyticsPeriodFilter) => void;
  stacked?: boolean;
};

function FilterControls({
  facultyFilter,
  onFacultyChange,
  facultyOptions,
  isLoadingFaculties,
  periodFilter,
  onPeriodFilterChange,
  stacked = false,
}: FilterControlsProps) {
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

  // Unified options arrays
  const periodOptions = [
    { value: "all", label: "All time" },
    { value: "year", label: "Year" },
    { value: "month", label: "Month" },
    { value: "range", label: "Range" },
  ];

  const yearSelectOptions = yearOptions.map((y) => ({ value: y, label: String(y) }));
  const monthSelectOptions = MONTH_OPTIONS.map((m) => ({ value: m.value, label: m.label }));
  const facultySelectOptions = facultyOptions.map((f) => ({
    value: String(f.id),
    label: f.faculty_name,
  }));

  const controlClass = stacked ? "w-full" : "";

  return (
    <div className={stacked ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-2"}>
      {/* Faculty */}
      <Control icon={<Building2 className="h-3.5 w-3.5" />} label="Faculty" className={controlClass}>
        <Select
          value={facultyFilter}
          onChange={(v) => onFacultyChange(v)}
          options={[{ value: "all", label: "All faculties" }, ...facultySelectOptions]}
          ariaLabel="Faculty filter"
          disabled={isLoadingFaculties}
          className="max-w-[10rem] sm:max-w-[12rem]"
        />
      </Control>

      {/* Period Type */}
      <Control icon={<CalendarRange className="h-3.5 w-3.5" />} label="Period" className={controlClass}>
        <Select
          value={periodFilter.periodType}
          onChange={(v) => setPeriodType(v as AnalyticsPeriodFilter["periodType"])}
          options={periodOptions}
          ariaLabel="Period type"
          className="max-w-[6.5rem]"
        />
      </Control>

      {/* Conditional: Year */}
      {(periodFilter.periodType === "year" || periodFilter.periodType === "month") && (
        <Control icon={<CalendarRange className="h-3.5 w-3.5" />} label="Year" className={controlClass}>
          <Select
            value={periodFilter.year}
            onChange={(v) => onPeriodFilterChange({ ...periodFilter, year: Number(v) })}
            options={yearSelectOptions}
            ariaLabel="Year"
            className="max-w-[4rem]"
          />
        </Control>
      )}

      {/* Conditional: Month */}
      {periodFilter.periodType === "month" && (
        <Control icon={<CalendarRange className="h-3.5 w-3.5" />} label="Month" className={controlClass}>
          <Select
            value={periodFilter.month}
            onChange={(v) => onPeriodFilterChange({ ...periodFilter, month: Number(v) })}
            options={monthSelectOptions}
            ariaLabel="Month"
            className="max-w-[5.5rem]"
          />
        </Control>
      )}

      {/* Conditional: Date Range */}
      {periodFilter.periodType === "range" && (
        <>
          <Control icon={<CalendarRange className="h-3.5 w-3.5" />} label="From" className={controlClass}>
            <DateInput
              value={periodFilter.dateFrom}
              max={periodFilter.dateTo || undefined}
              onChange={(v) => setDateRange({ dateFrom: v })}
              ariaLabel="Date range start"
            />
          </Control>
          <Control icon={<CalendarRange className="h-3.5 w-3.5" />} label="To" className={controlClass}>
            <DateInput
              value={periodFilter.dateTo}
              min={periodFilter.dateFrom || undefined}
              onChange={(v) => setDateRange({ dateTo: v })}
              ariaLabel="Date range end"
            />
          </Control>

          {/* Preset Chips */}
          <div className="flex items-center gap-1">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`
                  inline-flex items-center rounded-md px-2 py-1
                  text-[10px] font-semibold
                  ${tokens.transition}
                  ${
                    activePresetId === preset.id
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : `bg-gray-100 text-gray-600 ${tokens.surfaceHover} dark:bg-gray-800 dark:text-gray-300`
                  }
                `}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Desktop Filter Popover — icon trigger, panel on click
   ────────────────────────────────────────────────────────────── */
function DesktopFilterPopover(props: FilterControlsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filters"
        title="Filters"
        className={`
          inline-flex h-8 w-8 items-center justify-center rounded-lg border
          ${tokens.border} ${tokens.surfaceElevated} ${tokens.transition}
          ${tokens.surfaceHover} ${tokens.focusRing}
          ${open ? "bg-gray-100/90 ring-1 ring-gray-200 dark:bg-gray-800/90 dark:ring-gray-700" : ""}
        `}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" aria-hidden />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute right-0 top-full z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))]
              rounded-xl border ${tokens.border} ${tokens.surface}
              p-4 shadow-lg
            `}
            role="dialog"
            aria-label="Dashboard filters"
          >
            <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
              <SlidersHorizontal className="h-3.5 w-3.5 text-gray-500" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Filters
              </span>
            </div>
            <FilterControls {...props} stacked />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Trained Admins Badge — refined popover with better spacing
   ────────────────────────────────────────────────────────────── */
function TrainedAdminsBadge({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const admins = mapTrainedAdmins(data);
  const amber = ccAccent.amber;

  const closePopover = useCallback(() => setPopoverOpen(false), []);

  useEffect(() => {
    if (!popoverOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      closePopover();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen, closePopover]);

  const openFullDetails = () => {
    closePopover();
    setDrawerOpen(true);
  };

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setPopoverOpen((o) => !o)}
          className={`
            inline-flex items-center gap-1.5
            ${tokens.controlHeight} px-3
            rounded-lg border ${tokens.borderAccent}
            bg-amber-50/80 text-xs font-semibold text-amber-800
            ${tokens.transition} hover:bg-amber-100/80
            dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20
          `}
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
        >
          <UserCog className={`h-3.5 w-3.5 shrink-0 ${amber.icon}`} aria-hidden />
          <AnimatedNumber value={admins.total} />
          <span className="hidden sm:inline">Admins</span>
        </button>

        <AnimatePresence>
          {popoverOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`
                absolute right-0 top-full z-[60] mt-2
                w-[min(24rem,calc(100vw-2rem))]
                rounded-xl border ${tokens.borderAccent}
                bg-white p-4 shadow-xl shadow-gray-200/20
                dark:bg-gray-900 dark:shadow-black/20
              `}
              role="dialog"
              aria-label="Trained Faculty Admins"
            >
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCog className={`h-4 w-4 ${amber.icon}`} aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Trained Faculty Admins
                  </span>
                </div>
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  <AnimatedNumber value={admins.total} />
                </span>
              </div>

              {/* Faculty List */}
              <div className="overflow-x-auto scroll-smooth [scrollbar-width:thin]">
                <div className="flex w-max min-w-full items-center gap-2 pb-1">
                  {admins.byFaculty.length > 0 ? (
                    admins.byFaculty.map((f) => (
                      <div
                        key={f.faculty}
                        title={`${f.faculty}: ${f.count} admin${f.count === 1 ? "" : "s"}`}
                        className={`
                          inline-flex shrink-0 items-center gap-1.5
                          rounded-lg border ${tokens.border}
                          bg-gray-50/90 px-2.5 py-1
                          dark:bg-gray-800/60
                        `}
                      >
                        <span className="max-w-[7.5rem] truncate text-[10px] font-medium text-gray-600 dark:text-gray-300">
                          {f.facultyShort}
                        </span>
                        <span className="text-[11px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                          {f.count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {isLoading ? "Loading…" : "No faculty-scoped admins"}
                    </span>
                  )}
                </div>
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={openFullDetails}
                className={`
                  mt-3 w-full rounded-lg
                  border ${tokens.borderAccent}
                  bg-amber-50/50 px-3 py-2
                  text-[11px] font-semibold text-amber-800
                  ${tokens.transition} hover:bg-amber-100/80
                  dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20
                `}
              >
                View full details
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ExpandDrawer
        open={drawerOpen}
        title="Trained Faculty Admins"
        onClose={() => setDrawerOpen(false)}
        accent="amber"
        maxWidthClass="max-w-5xl"
      >
        <TrainedAdminsExpandPanel data={data} isLoading={isLoading} />
      </ExpandDrawer>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Mobile Filter Sheet — full-screen overlay instead of dropdown
   ────────────────────────────────────────────────────────────── */
function MobileFilterSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`
              fixed right-0 top-0 z-[80] h-full w-full max-w-sm
              ${tokens.surface} border-l ${tokens.border}
              shadow-2xl
            `}
            role="dialog"
            aria-label="Dashboard filters"
          >
            <div className="flex h-full flex-col">
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-semibold">Filters</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className={`
                    inline-flex h-8 w-8 items-center justify-center rounded-lg
                    ${tokens.surfaceHover} ${tokens.transition}
                  `}
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Sheet Content */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex flex-col gap-3">{children}</div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main Header — clean 3-zone layout with clear hierarchy
   ────────────────────────────────────────────────────────────── */
export function CommandCenterUnifiedHeader({
  facultyFilter,
  onFacultyChange,
  facultyOptions,
  isLoadingFaculties,
  periodFilter,
  onPeriodFilterChange,
  performance,
  data,
  isLoading,
}: {
  facultyFilter: string;
  onFacultyChange: (v: string) => void;
  facultyOptions: Array<{ id: number; faculty_name: string }>;
  isLoadingFaculties: boolean;
  periodFilter: AnalyticsPeriodFilter;
  onPeriodFilterChange: (f: AnalyticsPeriodFilter) => void;
  performance: React.ReactNode;
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { status } = useSession();

  const filterProps: FilterControlsProps = {
    facultyFilter,
    onFacultyChange,
    facultyOptions,
    isLoadingFaculties,
    periodFilter,
    onPeriodFilterChange,
  };

  return (
    <>
      <header
        className={`
          sticky top-0 z-50 shrink-0
          border-b ${tokens.border}
          ${tokens.surface}
          shadow-[0_1px_3px_rgba(0,0,0,0.04)]
          backdrop-blur-xl
          dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]
        `}
      >
        <div
          className={`
            mx-auto flex ${tokens.headerHeight} max-w-[1600px]
            items-center justify-between gap-2 px-3 lg:gap-3 lg:px-4 xl:gap-4 xl:px-6
          `}
        >
          {/* ═══════════════════════════════════════════════════════
              ZONE 1: Brand — left, minimal, confident
              ═══════════════════════════════════════════════════════ */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#183D32] dark:bg-emerald-600">
              <svg
                className="h-4 w-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </div>
            <h1 className="text-sm font-bold tracking-tight text-[#183D32] dark:text-emerald-300 sm:text-base">
              Portal Analytics
            </h1>
          </div>

          

          {/* ═══════════════════════════════════════════════════════
              ZONE 3: Actions — right, grouped and spaced
              ═══════════════════════════════════════════════════════ */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            
            {/* Performance widget */}
            <div className="hidden sm:block">{performance}</div>

            {/* Admins badge */}
            <TrainedAdminsBadge data={data} isLoading={isLoading} />

            {/* Divider */}
            <div className="hidden h-6 w-px bg-gray-200 dark:bg-gray-800 sm:block" />

            {/* Theme + User */}
            <div className="flex items-center gap-2">
              <div className="[&_button]:!h-8 [&_button]:!w-8 [&_button]:!rounded-lg [&_button]:!border-gray-200/60 [&_button]:!shadow-sm">
                <ThemeToggleButton />
              </div>
              {status === "loading" && (
                <span className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
              )}
              {/* Desktop: filter icon → popover */}
              <DesktopFilterPopover {...filterProps} />

              {/* Mobile / tablet: filter sheet */}
              <Control
                as="button"
                icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                label="Filters"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden"
              >
                <span className="text-xs font-medium ">Filters</span>
              </Control>

              {status === "authenticated" && <UserDropdown />}
              {status === "unauthenticated" && (
                <Link
                  href="/signin"
                  className="inline-flex items-center rounded-lg bg-[#183D32] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0f2e24] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Filter Sheet */}
      <MobileFilterSheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}>
        <FilterControls {...filterProps} stacked />
      </MobileFilterSheet>
    </>
  );
}