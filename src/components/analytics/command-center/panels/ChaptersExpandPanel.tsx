"use client";

import React, { useMemo } from "react";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { ChapterVerticalBarChart } from "../charts/ChapterVerticalBarChart";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapEngagementsChapters } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function buildTableRows(
  rows: { chapter: string; members: number }[],
  totalMembers: number
) {
  const body = rows.map((row) => ({
    chapter: row.chapter,
    members: row.members.toLocaleString(),
    share: pct(row.members, totalMembers),
  }));
  if (!body.length) return body;
  return [
    ...body,
    {
      chapter: "Total",
      members: totalMembers.toLocaleString(),
      share: totalMembers > 0 ? "100%" : "—",
    },
  ];
}

export function ChaptersExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const chapters = mapEngagementsChapters(data);

  const nationalTableRows = useMemo(
    () => buildTableRows(chapters.nationalRows, chapters.nationalMembers),
    [chapters.nationalRows, chapters.nationalMembers]
  );

  const internationalTableRows = useMemo(
    () => buildTableRows(chapters.internationalRows, chapters.internationalMembers),
    [chapters.internationalRows, chapters.internationalMembers]
  );

  const nationalChart = useMemo(
    () =>
      [...chapters.nationalRows]
        .filter((row) => row.members > 0)
        .sort((a, b) => b.members - a.members)
        .slice(0, 10)
        .map((row, i) => ({
          label: row.chapter,
          fullName: row.chapter,
          value: row.members,
          color: i === 0 ? KPI_COLOR_HEX.violet : undefined,
        })),
    [chapters.nationalRows]
  );

  const internationalChart = useMemo(
    () =>
      [...chapters.internationalRows]
        .filter((row) => row.members > 0)
        .sort((a, b) => b.members - a.members)
        .slice(0, 10)
        .map((row, i) => ({
          label: row.chapter,
          fullName: row.chapter,
          value: row.members,
          color: i === 0 ? KPI_COLOR_HEX.emerald : undefined,
        })),
    [chapters.internationalRows]
  );

  const kpis = [
    {
      label: "National chapters",
      value: chapters.national,
      sub: `${chapters.nationalMembers.toLocaleString()} alumni`,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Alumni in national chapters",
      value: chapters.nationalMembers,
      sub: "All chapter memberships",
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "International chapters",
      value: chapters.international,
      sub: `${chapters.internationalMembers.toLocaleString()} alumni`,
      color: KPI_COLOR_HEX.emerald,
    },
    {
      label: "Alumni in international chapters",
      value: chapters.internationalMembers,
      sub: "All chapter memberships",
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
      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 w-full">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          National chapters
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "chapter", label: "Chapter" },
            { key: "members", label: "Alumni", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={nationalTableRows}
        />
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 w-full">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Top national chapters by alumni
        </h3>
        {nationalChart.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No national chapter members</p>
        ) : (
          <ChapterVerticalBarChart data={nationalChart} accent="violet" height={475} />
        )}
      </section>
      </div>
      <div className="flex ">
      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 w-full">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          International chapters
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "chapter", label: "Chapter" },
            { key: "members", label: "Alumni", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={internationalTableRows}
        />
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 w-full">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Top international chapters by alumni
        </h3>
        {internationalChart.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No international chapter members</p>
        ) : (
          <ChapterVerticalBarChart data={internationalChart} accent="emerald" height={475} />
        )}
      </section>
      </div>
    </div>
  );
}
