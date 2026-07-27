"use client";

import React, { useState } from "react";
import { twMerge } from "tailwind-merge";
import { ChevronDownIcon, ChevronUpIcon, CloseLineIcon, DownloadIcon } from "@/icons";

export interface SearchToolbarAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost" | "primary";
  showLabel?: boolean;
  active?: boolean;
}

export interface SearchToolbarProps {
  title?: string;
  searchValue?: string;
  searchOnChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchId?: string;
  actions?: SearchToolbarAction[];
  filtersActive?: boolean;
  onClearFilters?: () => void;
  onResetSort?: () => void;
  showResetSort?: boolean;
  onExport?: () => void;
  exportDisabled?: boolean;
  isExporting?: boolean;
  isFetching?: boolean;
  exportLabel?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * SearchToolbar — compact, reusable toolbar for list views.
 *
 * Row 1: Section label (left) + action icon-button cluster (right)
 * Row 2: Full-width search input
 * Row 3: Collapsible filters panel (children)
 */
export default function SearchToolbar({
  title = "Search",
  searchValue = "",
  searchOnChange,
  searchPlaceholder = "Search...",
  searchId = "search-input",
  actions = [],
  filtersActive = false,
  onClearFilters,
  onResetSort,
  showResetSort = false,
  onExport,
  exportDisabled = false,
  isExporting = false,
  isFetching = false,
  exportLabel = "Export Excel",
  children,
  className,
}: SearchToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const iconBtnBase =
    "inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  return (
    <div
      className={twMerge(
        "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
        className
      )}
    >
      <div className="flex flex-col gap-2.5 p-3 sm:p-3.5">
        {/* Row 1: Title + Actions */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <div className="flex items-center gap-1.5">
            {/* Filters Toggle — outlined label button */}
            {children && (
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-all ${showFilters ? "border-blue-500 text-blue-600 bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:bg-blue-950/30" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:border-blue-500 dark:hover:text-blue-400 dark:hover:bg-blue-950/30"}`}
                aria-label="Toggle filters"
                title="Toggle filters"
              >
                {showFilters ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
                <span>Filters</span>
                {filtersActive && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-blue-500 rounded-full">
                    !
                  </span>
                )}
              </button>
            )}

            {/* Reset Sort — outlined label button */}
            {showResetSort && onResetSort && (
              <button
                type="button"
                onClick={onResetSort}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:border-amber-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/30 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-600 transition-all"
                aria-label="Reset sort"
                title="Reset sort"
              >
                <CloseLineIcon className="h-3.5 w-3.5" />
                <span>Reset Sort  </span>
              </button>
            )}

            {/* Clear Filters — outlined label button */}
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                disabled={!filtersActive}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:border-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:border-red-500 dark:hover:text-red-400 dark:hover:bg-red-950/30 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-600 disabled:hover:bg-transparent dark:disabled:hover:border-slate-600 dark:disabled:hover:text-slate-300 dark:disabled:hover:bg-transparent"
                aria-label="Clear filters"
                title="Clear filters"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Clear</span>
              </button>
            )}

            {/* Custom actions */}
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.label}
                title={action.label}
                className={twMerge(
                  iconBtnBase,
                  action.variant === "primary" &&
                    "bg-green-600 text-white hover:bg-green-700 hover:text-white dark:hover:bg-green-500 shadow-sm",
                  action.showLabel && "h-8 px-3 gap-1.5 w-auto"
                )}
              >
                {action.icon}
                {action.showLabel && (
                  <span className="text-xs font-semibold">{action.label}</span>
                )}
              </button>
            ))}

            {/* Export — primary labeled button */}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                disabled={exportDisabled}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                aria-label={exportLabel}
                title={exportLabel}
              >
                {isExporting ? (
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <DownloadIcon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{isExporting ? "Exporting..." : exportLabel}</span>
              </button>
            )}

            {/* Background refetch indicator */}
            {isFetching && (
              <div className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] font-medium hidden sm:inline">Updating...</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Search Input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id={searchId}
            type="text"
            value={searchValue}
            onChange={(e) => searchOnChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-900 dark:border-slate-700 text-sm font-medium text-slate-900 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-slate-100 transition-all duration-200"
          />
        </div>

        {/* Collapsible Filters Panel */}
        {children && (
          <div
            className={`transition-all duration-300 ease-in-out ${showFilters ? "overflow-visible" : "overflow-hidden"}`}
            style={{
              maxHeight: showFilters ? "5000px" : "0px",
              opacity: showFilters ? 1 : 0,
            }}
          >
            <div className="pt-1">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
