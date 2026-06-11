"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { Donut } from "../charts/Donut";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapPublicationsSurveys } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function truncateFaculty(name: string, max = 16): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function PublicationsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const publications = mapPublicationsSurveys(data);
  const facultyRows = publications.facultyRows;

  const tableRows = useMemo(() => {
    const body = facultyRows.map((row) => ({
      faculty: row.faculty,
      total: row.total.toLocaleString(),
      quarter: row.quarter.toLocaleString(),
      ytd: row.ytd.toLocaleString(),
      share: pct(row.total, publications.stories),
    }));
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        quarter: acc.quarter + row.quarter,
        ytd: acc.ytd + row.ytd,
      }),
      { total: 0, quarter: 0, ytd: 0 }
    );
    return [
      ...body,
      {
        faculty: "Total",
        total: sum.total.toLocaleString(),
        quarter: sum.quarter.toLocaleString(),
        ytd: sum.ytd.toLocaleString(),
        share: publications.stories > 0 ? "100%" : "—",
      },
    ];
  }, [facultyRows, publications.stories]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((row) => ({
          faculty: truncateFaculty(row.faculty),
          fullName: row.faculty,
          quarter: row.quarter,
          ytd: row.ytd,
        })),
    [facultyRows]
  );

  const facultyDistribution = useMemo(
    () =>
      [...facultyRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
        .map((row, i) => ({
          label: truncateFaculty(row.faculty, 20),
          value: row.total,
          color: [
            KPI_COLOR_HEX.violet,
            KPI_COLOR_HEX.indigo,
            KPI_COLOR_HEX.sky,
            KPI_COLOR_HEX.emerald,
            KPI_COLOR_HEX.amber,
            KPI_COLOR_HEX.rose,
          ][i % 6],
        })),
    [facultyRows]
  );

  const kpis = [
    {
      label: "Success stories",
      value: publications.stories,
      sub: "Published alumni stories",
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: publications.periodPrimary,
      value: publications.storiesQuarter,
      sub: publications.quarterLabel,
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: publications.periodSecondary,
      value: publications.storiesYtd,
      sub: "Success stories",
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Newsletters",
      value: publications.newsletters,
      sub: `${publications.newslettersQuarter.toLocaleString()} ${publications.periodPrimary.toLowerCase()}`,
      color: KPI_COLOR_HEX.amber,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Success stories sourced from alumni story submissions
        </p>
        <Link
          href="/alumni-stories?tab=viewStories"
          className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View stories →
        </Link>
      </div>

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

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Success stories by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "total", label: "Total", align: "right" },
            { key: "quarter", label: publications.periodPrimary, align: "right" },
            { key: "ytd", label: publications.periodSecondary, align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-1">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Top faculties
          </h3>
          <div className="h-[180px]">
            {facultyDistribution.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No faculty story data</p>
            ) : (
              <Donut data={facultyDistribution} showLegend minSlicePercent={0.04} />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-2">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Top faculties · {publications.periodPrimary} vs {publications.periodSecondary}
          </h3>
          {facultyChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No faculty story data</p>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={facultyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="faculty"
                    tick={{ fontSize: 9, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10 }}
                    labelFormatter={(_label, payload) =>
                      (payload?.[0]?.payload as { fullName?: string })?.fullName ?? _label
                    }
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  <Bar
                    dataKey="quarter"
                    name={publications.periodPrimary}
                    fill={KPI_COLOR_HEX.sky}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="ytd"
                    name={publications.periodSecondary}
                    fill={KPI_COLOR_HEX.violet}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
