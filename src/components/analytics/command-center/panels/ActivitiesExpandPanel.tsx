"use client";

import React, { useMemo } from "react";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { Bar as BarMini } from "../charts/Bar";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapEngagementActivities } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function ActivitiesExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const activities = mapEngagementActivities(data);
  const quarterCol = `L3M · ${activities.quarterLabel}`;

  const tableRows = useMemo(() => {
    const body = activities.rows.map((row) => ({
      activity: row.activity,
      quarter: row.quarter.toLocaleString(),
      ytd: row.ytd.toLocaleString(),
      share: pct(row.ytd, activities.ytdTotal),
    }));
    if (!body.length) return body;
    return [
      ...body,
      {
        activity: "Total",
        quarter: activities.quarterTotal.toLocaleString(),
        ytd: activities.ytdTotal.toLocaleString(),
        share: activities.ytdTotal > 0 ? "100%" : "—",
      },
    ];
  }, [activities]);

  const ytdChart = useMemo(
    () =>
      [...activities.rows]
        .filter((row) => row.ytd > 0)
        .sort((a, b) => b.ytd - a.ytd)
        .map((row, i) => ({
          label: row.activity.length > 14 ? `${row.activity.slice(0, 13)}…` : row.activity,
          value: row.ytd,
          color: i === 0 ? KPI_COLOR_HEX.violet : undefined,
        })),
    [activities.rows]
  );

  const quarterChart = useMemo(
    () =>
      [...activities.rows]
        .filter((row) => row.quarter > 0)
        .sort((a, b) => b.quarter - a.quarter)
        .map((row, i) => ({
          label: row.activity.length > 14 ? `${row.activity.slice(0, 13)}…` : row.activity,
          value: row.quarter,
          color: i === 0 ? KPI_COLOR_HEX.indigo : undefined,
        })),
    [activities.rows]
  );

  const kpis = [
    {
      label: "YTD total",
      value: activities.ytdTotal,
      sub: `${activities.activeTypes} active types`,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Last 3 Months",
      value: activities.quarterTotal,
      sub: activities.quarterLabel,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Top YTD",
      value: activities.topByYtd.ytd,
      sub: activities.topByYtd.activity,
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Top L3M",
      value: activities.topByQuarter.quarter,
      sub: activities.topByQuarter.activity,
      color: KPI_COLOR_HEX.amber,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: k.color }}>
              {k.value.toLocaleString()}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400" title={k.sub}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            YTD by activity
          </h3>
          {ytdChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No YTD activity data</p>
          ) : (
            <BarMini
              data={ytdChart}
              height={Math.max(140, ytdChart.length * 24)}
              horizontal
              showLabels
            />
          )}
        </section>

        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Last 3 months by activity
          </h3>
          {quarterChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No activity data in last 3 months</p>
          ) : (
            <BarMini
              data={quarterChart}
              height={Math.max(140, quarterChart.length * 24)}
              horizontal
              showLabels
            />
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Activity breakdown
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "activity", label: "Activity" },
            { key: "quarter", label: quarterCol, align: "right" },
            { key: "ytd", label: "YTD", align: "right" },
            { key: "share", label: "YTD share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>



      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Source: alumni talks & participation records (
        <a href="/alumni?tab=alumni-talks" className="text-violet-600 underline dark:text-violet-400">
          Alumni Talks
        </a>
        ). Counts respect faculty and period filters.
      </p>
    </div>
  );
}
