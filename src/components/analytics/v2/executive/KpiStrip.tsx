"use client";

import React from "react";
import { TrendBadge } from "../primitives/TrendBadge";
import type { KpiConfigGroup, KpiConfigItem } from "../utils/kpiConfig";

const SPARK_COLORS: Record<KpiConfigItem["color"], string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  orange: "#f97316",
  slate: "#64748b",
  blue: "#3b82f6",
};

function InlineSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data?.length || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 48;
  const h = 14;
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / range) * h}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-3.5 w-12 shrink-0" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-70"
      />
    </svg>
  );
}

function KpiTableSection({ group }: { group: KpiConfigGroup }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 border-b border-gray-100 bg-gray-50/90 px-2.5 py-1 dark:border-gray-800 dark:bg-gray-800/40">
        <h3 className="text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">{group.label}</h3>
        {group.description ? (
          <span className="hidden truncate text-[9px] text-gray-400 xl:inline dark:text-gray-500">{group.description}</span>
        ) : null}
      </div>
      <table className="w-full table-fixed">
        <tbody>
          {group.items.map((kpi) => (
            <tr
              key={kpi.title}
              className="border-b border-gray-50 last:border-0 hover:bg-indigo-50/30 dark:border-gray-800/60 dark:hover:bg-indigo-500/5"
            >
              <td className="w-[42%] truncate py-1 pl-2.5 pr-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                {kpi.title}
              </td>
              <td className="w-[28%] py-1 pr-1 text-right text-sm font-bold tabular-nums leading-none text-gray-900 dark:text-white">
                {kpi.value}
              </td>
              <td className="w-[14%] py-1 pr-1 text-right">
                {kpi.trend ? <TrendBadge value={kpi.trend.value} positive={kpi.trend.positive} compact /> : null}
              </td>
              <td className="hidden w-[16%] py-1 pr-2 sm:table-cell">
                {kpi.sparkline && kpi.sparkline.length >= 2 ? (
                  <InlineSparkline data={kpi.sparkline} color={SPARK_COLORS[kpi.color]} />
                ) : kpi.subtitle ? (
                  <span className="block truncate text-[9px] text-gray-400 dark:text-gray-500">{kpi.subtitle}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KpiStrip({ groups, isLoading }: { groups: KpiConfigGroup[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200/60 bg-white/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, g) => (
            <div key={g} className="border-b border-gray-100 p-2.5 dark:border-gray-800 md:[&:nth-child(odd)]:border-r">
              <div className="mb-2 h-2.5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mb-1.5 h-4 animate-pulse rounded bg-gray-100 dark:bg-gray-800/80" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50">
      <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-800 md:grid-cols-2 md:divide-x md:divide-y">
        {groups.map((group) => (
          <KpiTableSection key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
