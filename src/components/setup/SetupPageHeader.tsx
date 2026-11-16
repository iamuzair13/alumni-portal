"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";

export type SummaryChip = {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "accent" | "success" | "danger";
};

const CHIP_TONES: Record<NonNullable<SummaryChip["tone"]>, string> = {
  neutral:
    "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
  accent:
    "border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-800 dark:bg-accent-900/40 dark:text-accent-300",
  success:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface SetupPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbLabel?: string;
  chips?: SummaryChip[];
  action?: ReactNode;
  className?: string;
}

/**
 * Shared page header for /setup section tabs:
 * breadcrumb → title+description left, primary action right,
 * optional compact summary chips computed from already-loaded data.
 */
export function SetupPageHeader({
  title,
  description,
  breadcrumbLabel,
  chips,
  action,
  className,
}: SetupPageHeaderProps) {
  return (
    <div className={twMerge("mb-5", className)}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <li>
            <Link href="/setup" className="hover:text-accent-600 dark:hover:text-accent-300 transition-colors">
              Setup
            </Link>
          </li>
          <li aria-hidden className="text-gray-300 dark:text-gray-600">/</li>
          <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-200">
            {breadcrumbLabel ?? title}
          </li>
        </ol>
      </nav>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && (
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{description}</p>
          )}
          {chips && chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  className={twMerge(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    CHIP_TONES[chip.tone ?? "neutral"]
                  )}
                >
                  <span className="font-semibold tabular-nums">{chip.value}</span>
                  <span>{chip.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
