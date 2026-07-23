"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CATEGORY_SEGMENT_COLORS,
  MEDAL_SEGMENTS,
  type CategorySegmentConfig,
  type DashboardTabKey,
} from "./dashboard-stats-config";

function MedalSegment({
  config,
  value,
  isLoading,
  isSelected,
  onSelect,
}: {
  config: CategorySegmentConfig;
  value: number;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const colors = CATEGORY_SEGMENT_COLORS[config.key];

  const gradient =
    config.key === "goldMedalist"
      ? "bg-gradient-to-br from-yellow-300 via-yellow-200 to-white border-yellow-300 dark:border-yellow-500 hover:bg-yellow-200/80 dark:hover:bg-yellow-600/40"
      : config.key === "silverMedalist"
        ? "bg-gradient-to-br from-gray-300 via-gray-200 to-white border-gray-300 dark:border-gray-400 hover:bg-gray-200/80 dark:hover:bg-gray-600/40"
        : "bg-gradient-to-br from-orange-300 via-orange-200 to-white border-orange-300 dark:border-orange-500 hover:bg-orange-200/80 dark:hover:bg-orange-700/40";

  const labelColor =
    config.key === "goldMedalist"
      ? "text-yellow-700 dark:text-yellow-300"
      : config.key === "silverMedalist"
        ? "text-gray-700 dark:text-gray-300"
        : "text-orange-700 dark:text-orange-300";

  const valueColor = isSelected
    ? config.key === "goldMedalist"
      ? "text-yellow-800 dark:text-yellow-200"
      : config.key === "silverMedalist"
        ? "text-gray-800 dark:text-gray-200"
        : "text-orange-800 dark:text-orange-200"
    : labelColor;

  const dotColor =
    config.key === "goldMedalist"
      ? "bg-yellow-400"
      : config.key === "silverMedalist"
        ? "bg-gray-400"
        : "bg-orange-400";

  const button = (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`
        flex h-full w-[120px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-3
        last:border-r-0
        transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/40
        ${isSelected ? colors.active : ""}
        ${gradient}
      `}
    >
      <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? colors.text : labelColor}`}>
        {config.label}
      </span>
      {isLoading ? (
        <span className="mt-1 inline-flex h-7 w-12 items-center justify-center">
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${dotColor}`} />
        </span>
      ) : (
        <span className={`text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${valueColor}`}>
          {value.toLocaleString()}
        </span>
      )}
    </button>
  );

  if (config.tooltip) {
    return (
      <div className="flex min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return <div className="flex min-w-0 flex-1">{button}</div>;
}

export type MedalistCategoryCardProps = {
  selected: DashboardTabKey;
  onSelect: (key: DashboardTabKey) => void;
  counts: {
    gold: number;
    silver: number;
    bronze: number;
  };
  isLoading?: boolean;
};

export function MedalistCategoryCard({
  selected,
  onSelect,
  counts,
  isLoading = false,
}: MedalistCategoryCardProps) {
  const valueByKey: Record<string, number> = {
    goldMedalist: counts.gold,
    silverMedalist: counts.silver,
    bronzeMedalist: counts.bronze,
  };

  return (
    <div
      className="
        overflow-hidden rounded-[20px] border border-white/60 bg-white/70 backdrop-blur-md
        shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-300
        dark:border-gray-700/60 dark:bg-gray-900/60 dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)]
      "
      role="tablist"
      aria-label="Medalists"
    >
      <div className="border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/80">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Medalists
        </h3>
      </div>
      <div className="flex divide-x-0">
        {MEDAL_SEGMENTS.map((segment) => (
          <MedalSegment
            key={segment.key}
            config={segment}
            value={valueByKey[segment.key] ?? 0}
            isLoading={isLoading}
            isSelected={selected === segment.key}
            onSelect={() => onSelect(segment.key)}
          />
        ))}
      </div>
    </div>
  );
}
