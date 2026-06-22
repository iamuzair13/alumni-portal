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
import { Bar as BarMini } from "../charts/Bar";
import { Donut } from "../charts/Donut";
import { OccupationRadar } from "../charts/OccupationRadar";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapAlumniOccupation } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

const VERIFIED_ONLY = { verifiedOnly: true } as const;

const STATUS_SERIES = [
  { key: "employed", label: "Employed", fill: KPI_COLOR_HEX.emerald },
  { key: "selfEmployed", label: "Self-employed", fill: KPI_COLOR_HEX.sky },
  { key: "unemployedSearching", label: "Searching", fill: KPI_COLOR_HEX.amber },
  { key: "unemployedByChoice", label: "By choice", fill: KPI_COLOR_HEX.orange },
  { key: "other", label: "Other", fill: KPI_COLOR_HEX.slate },
] as const;

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function rowTotal(r: {
  employed: number;
  selfEmployed: number;
  unemployedSearching: number;
  unemployedByChoice: number;
  other: number;
}): number {
  return r.employed + r.selfEmployed + r.unemployedSearching + r.unemployedByChoice + r.other;
}

export function OccupationExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const occupation = mapAlumniOccupation(data, VERIFIED_ONLY);
  const facultyRows = data?.sectionA?.facultyOccupationRows ?? [];
  const oc = data?.sectionA?.verifiedCurrentOccupation;

  const statusTotals = useMemo(
    () => ({
      employed: oc?.employed ?? 0,
      selfEmployed: oc?.selfEmployed ?? 0,
      unemployedSearching: oc?.unemployedSearching ?? 0,
      unemployedByChoice: oc?.unemployedByChoice ?? 0,
      other: oc?.other ?? 0,
    }),
    [oc]
  );

  const grandTotal = rowTotal(statusTotals);

  const tableRows = useMemo(() => {
    const body = facultyRows.map((r) => {
      const total = rowTotal(r);
      return {
        faculty: r.faculty,
        employed: r.employed.toLocaleString(),
        selfEmployed: r.selfEmployed.toLocaleString(),
        unemployedSearching: r.unemployedSearching.toLocaleString(),
        unemployedByChoice: r.unemployedByChoice.toLocaleString(),
        other: r.other.toLocaleString(),
        total: total.toLocaleString(),
        share: pct(total, grandTotal),
      };
    });
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, r) => ({
        employed: acc.employed + r.employed,
        selfEmployed: acc.selfEmployed + r.selfEmployed,
        unemployedSearching: acc.unemployedSearching + r.unemployedSearching,
        unemployedByChoice: acc.unemployedByChoice + r.unemployedByChoice,
        other: acc.other + r.other,
      }),
      { employed: 0, selfEmployed: 0, unemployedSearching: 0, unemployedByChoice: 0, other: 0 }
    );
    const total = rowTotal(sum);
    return [
      ...body,
      {
        faculty: "Total",
        employed: sum.employed.toLocaleString(),
        selfEmployed: sum.selfEmployed.toLocaleString(),
        unemployedSearching: sum.unemployedSearching.toLocaleString(),
        unemployedByChoice: sum.unemployedByChoice.toLocaleString(),
        other: sum.other.toLocaleString(),
        total: total.toLocaleString(),
        share: grandTotal > 0 ? "100.0%" : "—",
      },
    ];
  }, [facultyRows, grandTotal]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .map((r) => ({ ...r, total: rowTotal(r) }))
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((r) => ({
          ...facultyBarChartRow(r.faculty),
          employed: r.employed,
          selfEmployed: r.selfEmployed,
          unemployedSearching: r.unemployedSearching,
          unemployedByChoice: r.unemployedByChoice,
          other: r.other,
        })),
    [facultyRows]
  );

  const kpis = [
    { label: "Employed", value: statusTotals.employed, color: KPI_COLOR_HEX.emerald },
    { label: "Self-employed", value: statusTotals.selfEmployed, color: KPI_COLOR_HEX.sky },
    { label: "Searching", value: statusTotals.unemployedSearching, color: KPI_COLOR_HEX.amber },
    { label: "By choice", value: statusTotals.unemployedByChoice, color: KPI_COLOR_HEX.orange },
    { label: "Other", value: statusTotals.other, color: KPI_COLOR_HEX.slate },
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
              {pct(k.value ?? 0, grandTotal)} of with status
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Top faculties · occupation breakdown
        </h3>
        {facultyChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No faculty occupation data</p>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
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
                {STATUS_SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.fill}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={20}
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
          Occupation by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "employed", label: "Employed", align: "right" },
            { key: "selfEmployed", label: "Self-emp.", align: "right" },
            { key: "unemployedSearching", label: "Searching", align: "right" },
            { key: "unemployedByChoice", label: "By choice", align: "right" },
            { key: "other", label: "Other", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>


      
    </div>
  );
}
