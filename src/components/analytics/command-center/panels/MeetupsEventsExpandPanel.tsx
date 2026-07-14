"use client";

import React, { useMemo } from "react";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { ChapterVerticalBarChart } from "../charts/ChapterVerticalBarChart";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapMeetupsEvents } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function buildChapterTableRows(
  rows: { chapter: string; total: number; ytd: number; quarter: number }[],
  grandTotal: number
) {
  const body = rows.map((row) => ({
    chapter: row.chapter,
    total: row.total.toLocaleString(),
    ytd: row.ytd.toLocaleString(),
    quarter: row.quarter.toLocaleString(),
    share: pct(row.total, grandTotal),
  }));
  if (!body.length) return body;
  const sum = rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      ytd: acc.ytd + row.ytd,
      quarter: acc.quarter + row.quarter,
    }),
    { total: 0, ytd: 0, quarter: 0 }
  );
  return [
    ...body,
    {
      chapter: "Total",
      total: sum.total.toLocaleString(),
      ytd: sum.ytd.toLocaleString(),
      quarter: sum.quarter.toLocaleString(),
      share: grandTotal > 0 ? "100%" : "—",
    },
  ];
}

export function MeetupsEventsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const stats = mapMeetupsEvents(data);
  const quarterCol = `L3M · ${stats.quarterLabel}`;

  const activeEventsRows = useMemo(
    () => stats.eventsChapterRows.filter((row) => row.total > 0),
    [stats.eventsChapterRows]
  );

  const activeMeetupsRows = useMemo(
    () => stats.meetupsChapterRows.filter((row) => row.total > 0),
    [stats.meetupsChapterRows]
  );

  const eventsTableRows = useMemo(
    () => buildChapterTableRows(activeEventsRows, stats.events.total),
    [activeEventsRows, stats.events.total]
  );

  const meetupsTableRows = useMemo(
    () => buildChapterTableRows(activeMeetupsRows, stats.meetups.total),
    [activeMeetupsRows, stats.meetups.total]
  );

  const eventsChart = useMemo(
    () =>
      [...activeEventsRows]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((row, i) => ({
          label: row.chapter,
          fullName: row.chapter,
          value: row.total,
          color: i === 0 ? KPI_COLOR_HEX.violet : undefined,
        })),
    [activeEventsRows]
  );

  const meetupsChart = useMemo(
    () =>
      [...activeMeetupsRows]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((row, i) => ({
          label: row.chapter,
          fullName: row.chapter,
          value: row.total,
          color: i === 0 ? KPI_COLOR_HEX.emerald : undefined,
        })),
    [activeMeetupsRows]
  );

  const chapterColumns = [
    { key: "chapter", label: "Chapter" },
    { key: "total", label: "Total", align: "right" as const },
    { key: "ytd", label: "YTD", align: "right" as const },
    { key: "quarter", label: quarterCol, align: "right" as const },
    { key: "share", label: "Share", align: "right" as const },
  ];

  const kpis = [
    {
      label: "All events",
      value: stats.events.total,
      sub: `${stats.events.ytd.toLocaleString()} YTD · ${stats.events.quarter.toLocaleString()} L3M`,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Events YTD",
      value: stats.events.ytd,
      sub: `${stats.events.quarter.toLocaleString()} in last 3 months`,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "All meetups",
      value: stats.meetups.total,
      sub: `${stats.meetups.ytd.toLocaleString()} YTD · ${stats.meetups.quarter.toLocaleString()} L3M`,
      color: KPI_COLOR_HEX.emerald,
    },
    {
      label: "Meetups YTD",
      value: stats.meetups.ytd,
      sub: `${stats.meetups.quarter.toLocaleString()} in last 3 months`,
      color: KPI_COLOR_HEX.emerald,
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
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex ">
        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Events by chapter
          </h3>
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={chapterColumns}
            rows={eventsTableRows}
          />
        </section>

        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Top chapters · events
          </h3>
          {eventsChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No chapter events recorded</p>
          ) : (
            <ChapterVerticalBarChart data={eventsChart} accent="violet" height={475} />
          )}
        </section>
      </div>

      <div className="flex ">
        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Meetups by chapter
          </h3>
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={chapterColumns}
            rows={meetupsTableRows}
          />
        </section>

        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Top chapters · meetups
          </h3>
          {meetupsChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No chapter meetups recorded</p>
          ) : (
            <ChapterVerticalBarChart data={meetupsChart} accent="emerald" height={475} />
          )}
        </section>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Source:{" "}
        <a href="/events?tab=viewEvents" className="text-violet-600 underline dark:text-violet-400">
          Events admin
        </a>
        . Meetups are events whose category contains &quot;meetup&quot;; all other entries count as events.
        Chapters with zero events or meetups are omitted from the tables and charts.
      </p>
    </div>
  );
}
