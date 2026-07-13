"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapCareerBenefits } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

const SCHOLARSHIP_SERIES = [
  { key: "kinship", label: "Kinship", fill: KPI_COLOR_HEX.indigo },
  { key: "masters", label: "Masters / PhD", fill: KPI_COLOR_HEX.violet },
] as const;

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function ScholarshipsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const career = mapCareerBenefits(data);
  const facultyRows = career.facultyScholarshipRows;
  const totals = career.scholarshipTotals;

  const typeTotals = useMemo(
    () => ({
      kinship: totals.kinshipApproved,
      masters: totals.mastersApproved,
      iq: totals.iqApproved,
    }),
    [totals]
  );

  const grandTotal = typeTotals.kinship + typeTotals.masters + typeTotals.iq;

  const tableRows = useMemo(() => {
    const body = facultyRows
      .filter((row) => row.applied > 0)
      .map((row) => ({
        faculty: row.faculty,
        kinship: row.kinshipApproved.toLocaleString(),
        masters: row.mastersApproved.toLocaleString(),
        iq: row.iqApproved.toLocaleString(),
        applied: row.applied.toLocaleString(),
        approved: row.approved.toLocaleString(),
        total: row.approved.toLocaleString(),
        share: pct(row.approved, grandTotal),
      }));
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, row) => ({
        kinship: acc.kinship + row.kinshipApproved,
        masters: acc.masters + row.mastersApproved,
        iq: acc.iq + row.iqApproved,
        applied: acc.applied + row.applied,
        approved: acc.approved + row.approved,
      }),
      { kinship: 0, masters: 0, iq: 0, applied: 0, approved: 0 }
    );
    return [
      ...body,
      {
        faculty: "Total",
        kinship: sum.kinship.toLocaleString(),
        masters: sum.masters.toLocaleString(),
        iq: sum.iq.toLocaleString(),
        applied: sum.applied.toLocaleString(),
        approved: sum.approved.toLocaleString(),
        total: sum.approved.toLocaleString(),
        share: grandTotal > 0 ? "100.0%" : "—",
      },
    ];
  }, [facultyRows, grandTotal]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .filter((row) => row.approved > 0)
        .sort((a, b) => b.approved - a.approved)
        .slice(0, 8)
        .map((row) => ({
          ...facultyBarChartRow(row.faculty),
          kinship: row.kinshipApproved,
          masters: row.mastersApproved,
          iq: row.iqApproved,
        })),
    [facultyRows]
  );

  const kpis = [
    {
      label: "Kinship",
      value: typeTotals.kinship,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Masters / PhD",
      value: typeTotals.masters,
      color: KPI_COLOR_HEX.violet,
    },
    
    {
      label: "Applications",
      value: career.scholarshipsApplied,
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Approved",
      value: career.scholarshipsApproved,
      color: KPI_COLOR_HEX.emerald,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: k.color }}>
              {(k.value ?? 0).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              {k.label === "Applications" || k.label === "Approved"
                ? k.label === "Approved"
                  ? pct(k.value ?? 0, career.scholarshipsApplied) + " of applied"
                  : career.scholarshipsPending > 0
                    ? `${career.scholarshipsPending.toLocaleString()} pending`
                    : `${career.scholarshipsProcessed.toLocaleString()} processed`
                : pct(k.value ?? 0, grandTotal) + " of approved"}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Top faculties · scholarship breakdown
        </h3>
        {facultyChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No faculty scholarship data</p>
        ) : (
          <div className="h-[240px] w-full">
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
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  labelFormatter={facultyTooltipLabel}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {SCHOLARSHIP_SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.fill}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey={s.key}
                      position="top"
                      fontSize={7}
                      fontWeight={600}
                      fill="#6b7280"
                      formatter={(v: number) => (v > 0 ? v.toLocaleString() : "")}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Scholarships by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "kinship", label: "Kinship", align: "right" },
            { key: "masters", label: "Masters / PhD", align: "right" },
            { key: "applied", label: "Applied", align: "right" },
            { key: "approved", label: "Approved", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>
    </div>
  );
}
