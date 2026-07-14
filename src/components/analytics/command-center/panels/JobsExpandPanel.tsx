"use client";

import React, { useMemo } from "react";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { ChapterVerticalBarChart } from "../charts/ChapterVerticalBarChart";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapCareerBenefits } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function JobsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const career = mapCareerBenefits(data);
  const quarterCol = `L3M · ${career.quarterLabel}`;

  const activeCompanyRows = useMemo(
    () => career.jobs.companyRows.filter((row) => row.total > 0),
    [career.jobs.companyRows]
  );

  const jobCompanyRows = useMemo(() => {
    const body = activeCompanyRows.map((row) => ({
      company: row.company,
      total: row.total.toLocaleString(),
      uol: row.uol.toLocaleString(),
      other: row.other.toLocaleString(),
      quarter: row.quarter.toLocaleString(),
      ytd: row.ytd.toLocaleString(),
      share: pct(row.total, career.jobs.total),
    }));
    if (!body.length) return body;
    const sum = activeCompanyRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        uol: acc.uol + row.uol,
        other: acc.other + row.other,
        quarter: acc.quarter + row.quarter,
        ytd: acc.ytd + row.ytd,
      }),
      { total: 0, uol: 0, other: 0, quarter: 0, ytd: 0 }
    );
    return [
      ...body,
      {
        company: "Total",
        total: sum.total.toLocaleString(),
        uol: sum.uol.toLocaleString(),
        other: sum.other.toLocaleString(),
        quarter: sum.quarter.toLocaleString(),
        ytd: sum.ytd.toLocaleString(),
        share: career.jobs.total > 0 ? "100%" : "—",
      },
    ];
  }, [activeCompanyRows, career.jobs.total]);

  const companyChart = useMemo(
    () =>
      [...activeCompanyRows]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((row, i) => ({
          label: row.company,
          fullName: row.company,
          value: row.total,
          color: i === 0 ? KPI_COLOR_HEX.violet : undefined,
        })),
    [activeCompanyRows]
  );

  const jobKpis = useMemo(
    () =>
      [
        {
          label: "Total jobs",
          value: career.jobs.total,
          sub: "All postings",
          color: KPI_COLOR_HEX.violet,
        },
        {
          label: "UOL",
          value: career.jobs.uol,
          sub: `${pct(career.jobs.uol, career.jobs.total)} of total`,
          color: KPI_COLOR_HEX.indigo,
        },
        {
          label: "Other employers",
          value: career.jobs.other,
          sub: `${pct(career.jobs.other, career.jobs.total)} of total`,
          color: KPI_COLOR_HEX.sky,
        },
        {
          label: "Last 3 Months",
          value: career.jobs.quarter,
          sub: career.quarterLabel,
          color: KPI_COLOR_HEX.amber,
        },
      ].filter((k) => k.value > 0),
    [career.jobs, career.quarterLabel]
  );

  return (
    <div className="space-y-5">
      {jobKpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {jobKpis.map((k) => (
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
      ) : null}

      <div className="flex">
        <section className="flex w-full flex-col rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Jobs by Company
          </h4>
          <div className="max-h-[475px] overflow-y-auto pr-1">
            <AnalyticsDataTable
              isLoading={isLoading}
              columns={[
                { key: "company", label: "Company" },
                { key: "total", label: "Total", align: "right" },
                { key: "quarter", label: quarterCol, align: "right" },
                { key: "ytd", label: "YTD", align: "right" },
                { key: "share", label: "Share", align: "right" },
              ]}
              rows={jobCompanyRows}
            />
          </div>
        </section>

        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Top job companies
          </h4>
          {companyChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No companies recorded</p>
          ) : (
            <ChapterVerticalBarChart
              data={companyChart}
              accent="violet"
              height={475}
              valueLabel="Jobs"
            />
          )}
        </section>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Jobs from{" "}
        <a href="/dashboard?tab=jobs" className="text-violet-600 underline dark:text-violet-400">
          Job board
        </a>
        . Companies with zero postings are omitted. Jobs are organization-wide.
      </p>
    </div>
  );
}
