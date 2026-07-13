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
import { abbreviateFacultyLabel, facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

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
      total: row.approved.toLocaleString(),
      quarter: row.quarter.toLocaleString(),
      ytd: row.ytd.toLocaleString(),
      share: pct(row.approved, publications.storiesApproved),
    }));
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, row) => ({
        total: acc.total + row.approved,
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
        share: publications.storiesApproved > 0 ? "100%" : "—",
      },
    ];
  }, [facultyRows, publications.storiesApproved]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.approved - a.approved)
        .slice(0, 8)
        .map((row) => ({
          ...facultyBarChartRow(row.faculty),
          submitted: row.total,
          approved: row.approved,
        })),
    [facultyRows]
  );

  const facultyDistribution = useMemo(
    () =>
      [...facultyRows]
        .filter((row) => row.approved > 0)
        .sort((a, b) => b.approved - a.approved)
        .slice(0, 6)
        .map((row, i) => ({
          label: abbreviateFacultyLabel(row.faculty),
          value: row.approved,
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

  const storiesPending = Math.max(0, publications.stories - publications.storiesApproved);
  const approvalRate = publications.stories > 0
    ? `${Math.round((publications.storiesApproved / publications.stories) * 100)}%`
    : "—";

  const storyKpis = [
    { label: "Approved", value: publications.storiesApproved, sub: `${approvalRate} approval rate`, color: KPI_COLOR_HEX.violet },
    { label: "Submitted", value: publications.stories, sub: "Total submissions", color: KPI_COLOR_HEX.indigo },
  ];

  return (
    <div className="space-y-6">

      {/* ── Section 1: Success Stories ─────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-violet-600 dark:text-violet-400">
            ✦ Success Stories
          </h2>
          <Link
            href="/alumni-stories?tab=viewStories"
            className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
          >
            View stories →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {storyKpis.map((k) => (
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

        
        <div className="">

          <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 w-full">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Approved stories by faculty
            </h3>
            {facultyChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No faculty story data</p>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={facultyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                    <XAxis dataKey="faculty" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 10 }}
                      labelFormatter={facultyTooltipLabel}
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="submitted" name="Submitted" fill={KPI_COLOR_HEX.indigo} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                    <Bar dataKey="approved" name="Approved" fill={KPI_COLOR_HEX.violet} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>

        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Approved stories by faculty
          </h3>
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "faculty", label: "Faculty" },
              { key: "total", label: "Approved", align: "right" },
              { key: "quarter", label: publications.periodPrimary, align: "right" },
              { key: "ytd", label: publications.periodSecondary, align: "right" },
              { key: "share", label: "Share", align: "right" },
            ]}
            rows={tableRows}
          />
        </div>

      </section>

      {/* ── Section 2: Newsletters ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-teal-600 dark:text-teal-400">
          ✦ Newsletters
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Issued</p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: "#14B8A6" }}>
              {publications.newsletters.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">Total newsletters issued</p>
          </div>
          <div className="col-span-1 sm:col-span-3 flex items-center rounded-xl border border-dashed border-teal-200 bg-teal-50/40 px-4 py-3 dark:border-teal-800/50 dark:bg-teal-900/10">
            <p className="text-xs text-teal-700 dark:text-teal-400">
              Newsletter tracking will be available in a future update. Data will appear here once newsletters are integrated.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
