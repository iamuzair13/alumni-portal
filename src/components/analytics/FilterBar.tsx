"use client";

import React from "react";
import type { AnalyticsModule, AnalyticsPeriod } from "@/lib/analytics/types";

const moduleOptions: Array<{ value: AnalyticsModule; label: string }> = [
  { value: "dashboard", label: "Alumni (All)" },
  { value: "alumni_cards", label: "Alumni Cards" },
  { value: "alumni_talks", label: "Alumni Talks" },
  { value: "alumni_chapters", label: "Alumni Chapters" },
  { value: "alumni_association", label: "Alumni Association" },
  { value: "scholarships", label: "Alumni Scholarships" },
  { value: "memberships", label: "Alumni Memberships" },
  { value: "leadership", label: "Leadership" },
  { value: "jobs", label: "Jobs" },
];

const periodOptions: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function FilterBar(props: {
  module: AnalyticsModule;
  period: AnalyticsPeriod;
  onModuleChange: (v: AnalyticsModule) => void;
  onPeriodChange: (v: AnalyticsPeriod) => void;
  disabled?: boolean;
}) {
  const disabled = Boolean(props.disabled);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Module</label>
          <select
            className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            value={props.module}
            onChange={(e) => props.onModuleChange(e.target.value as AnalyticsModule)}
            disabled={disabled}
          >
            {moduleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Period</label>
          <select
            className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            value={props.period}
            onChange={(e) => props.onPeriodChange(e.target.value as AnalyticsPeriod)}
            disabled={disabled}
          >
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

