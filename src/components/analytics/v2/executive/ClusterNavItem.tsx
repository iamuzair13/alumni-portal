"use client";

import React from "react";
import { AnalyticsChartRenderer } from "../charts/AnalyticsChartRenderer";
import { RegistrationTrendChart } from "./RegistrationTrendChart";
import {
  analyticsNavClusterCard,
  analyticsSectionTitle,
} from "../layout/analyticsTheme";
import { pickPreviewGroup, type ResolvedSectionCluster } from "../utils/sectionClusters";
import type { RegistrationTrendChartPoint } from "../utils/buildRegistrationTrendChartSeries";

export function ClusterNavItem({
  cluster,
  selected,
  onSelect,
  registrationTrend,
  periodLabel,
  granularity,
  isLoading,
}: {
  cluster: ResolvedSectionCluster;
  selected: boolean;
  onSelect: () => void;
  registrationTrend?: {
    points: RegistrationTrendChartPoint[];
    asOfLabel: string | null;
    granularity: "daily" | "monthly";
  };
  periodLabel?: string;
  granularity?: "daily" | "monthly";
  isLoading?: boolean;
}) {
  const showRegistration = cluster.id === "section-1" && registrationTrend;
  const previewGroup = showRegistration ? undefined : pickPreviewGroup(cluster);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`${analyticsNavClusterCard} rounded-xl border p-2.5 text-left transition-colors ${
        selected
          ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-400/25 dark:border-indigo-500/60 dark:bg-indigo-950/40 dark:ring-indigo-400/20"
          : "border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/80 dark:hover:border-gray-700 dark:hover:bg-gray-800/60"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${selected ? "rotate-90 text-indigo-500" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className={`${analyticsSectionTitle} truncate text-xs`}>{cluster.label}</span>
      </div>

      <div className="pointer-events-none min-h-0 flex-1 overflow-hidden">
        {showRegistration ? (
          <RegistrationTrendChart
            data={registrationTrend.points}
            periodLabel={periodLabel ?? ""}
            asOfLabel={registrationTrend.asOfLabel}
            granularity={granularity ?? registrationTrend.granularity}
            isLoading={!!isLoading}
            compact
            embedded
            navPreview
          />
        ) : previewGroup ? (
          <AnalyticsChartRenderer group={previewGroup} compact navPreview showLabels={false} />
        ) : (
          <div className="flex h-[72px] items-center justify-center text-[10px] text-gray-400">
            No preview data
          </div>
        )}
      </div>
    </button>
  );
}
