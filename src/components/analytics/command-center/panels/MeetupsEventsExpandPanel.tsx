"use client";

import React, { useMemo } from "react";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { Bar as BarMini } from "../charts/Bar";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapMeetupsEvents } from "../data/mapPayloadToCards";
function buildChapterTableRows(
  rows: { chapter: string; total: number; ytd: number; quarter: number }[]
) {
  const body = rows.map((row) => ({
    chapter: row.chapter,
    total: row.total.toLocaleString(),
    ytd: row.ytd.toLocaleString(),
    quarter: row.quarter.toLocaleString(),
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
  const quarterCol = `This Q · ${stats.quarterLabel}`;

  const eventsTableRows = useMemo(
    () => buildChapterTableRows(stats.eventsChapterRows),
    [stats.eventsChapterRows]
  );

  const meetupsTableRows = useMemo(
    () => buildChapterTableRows(stats.meetupsChapterRows),
    [stats.meetupsChapterRows]
  );

  const eventsChart = useMemo(
    () =>
      [...stats.eventsChapterRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((row) => ({
          label: row.chapter.length > 14 ? `${row.chapter.slice(0, 13)}…` : row.chapter,
          value: row.total,
        })),
    [stats.eventsChapterRows]
  );

  const meetupsChart = useMemo(
    () =>
      [...stats.meetupsChapterRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((row) => ({
          label: row.chapter.length > 14 ? `${row.chapter.slice(0, 13)}…` : row.chapter,
          value: row.total,
        })),
    [stats.meetupsChapterRows]
  );

  const summaryColumns = [
    { key: "metric", label: "Metric" },
    { key: "total", label: "Total", align: "right" as const },
    { key: "ytd", label: "YTD", align: "right" as const },
    { key: "quarter", label: quarterCol, align: "right" as const },
  ];

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Events
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={summaryColumns}
          rows={[
            {
              metric: "All events",
              total: stats.events.total.toLocaleString(),
              ytd: stats.events.ytd.toLocaleString(),
              quarter: stats.events.quarter.toLocaleString(),
            },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Events by chapter
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "chapter", label: "Chapter" },
            { key: "total", label: "Total", align: "right" },
            { key: "ytd", label: "YTD", align: "right" },
            { key: "quarter", label: quarterCol, align: "right" },
          ]}
          rows={eventsTableRows}
        />
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Top chapters · events
        </h3>
        {eventsChart.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No chapter events recorded</p>
        ) : (
          <BarMini
            data={eventsChart}
            height={Math.max(120, eventsChart.length * 22)}
            horizontal
            showLabels
          />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Meetups
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={summaryColumns}
          rows={[
            {
              metric: "All meetups",
              total: stats.meetups.total.toLocaleString(),
              ytd: stats.meetups.ytd.toLocaleString(),
              quarter: stats.meetups.quarter.toLocaleString(),
            },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Meetups by chapter
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "chapter", label: "Chapter" },
            { key: "total", label: "Total", align: "right" },
            { key: "ytd", label: "YTD", align: "right" },
            { key: "quarter", label: quarterCol, align: "right" },
          ]}
          rows={meetupsTableRows}
        />
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Top chapters · meetups
        </h3>
        {meetupsChart.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No chapter meetups recorded</p>
        ) : (
          <BarMini
            data={meetupsChart}
            height={Math.max(120, meetupsChart.length * 22)}
            horizontal
            showLabels
          />
        )}
      </section>

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Source:{" "}
        <a href="/events?tab=viewEvents" className="text-violet-600 underline dark:text-violet-400">
          Events admin
        </a>
        . Meetups are events whose category contains &quot;meetup&quot;; all other entries count as events.
      </p>
    </div>
  );
}
