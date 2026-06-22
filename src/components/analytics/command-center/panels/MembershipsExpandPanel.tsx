"use client";

import React, { useMemo } from "react";
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
import { mapMembershipsPerks } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

const MEMBERSHIP_SERIES = [
  { key: "gym", label: "Gym", fill: KPI_COLOR_HEX.indigo },
  { key: "pool", label: "Pool", fill: KPI_COLOR_HEX.sky },
  { key: "qalander", label: "Qalandar", fill: KPI_COLOR_HEX.amber },
] as const;

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function fmtApprovedApplied(approved: number, applied: number): string {
  return `${approved.toLocaleString()} (${applied.toLocaleString()} applied)`;
}

export function MembershipsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const memberships = mapMembershipsPerks(data);
  const facultyRows = memberships.facultyRows;

  const tableRows = useMemo(() => {
    const body = facultyRows.map((row) => ({
      faculty: row.faculty,
      total: row.total.toLocaleString(),
      gym: fmtApprovedApplied(row.gymApproved ?? 0, row.gym),
      pool: fmtApprovedApplied(row.poolApproved ?? 0, row.pool),
      qalander: fmtApprovedApplied(row.qalanderApproved ?? 0, row.qalander),
      share: pct(row.total, memberships.total),
    }));
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        gym: acc.gym + row.gym,
        pool: acc.pool + row.pool,
        qalander: acc.qalander + row.qalander,
        gymApproved: acc.gymApproved + (row.gymApproved ?? 0),
        poolApproved: acc.poolApproved + (row.poolApproved ?? 0),
        qalanderApproved: acc.qalanderApproved + (row.qalanderApproved ?? 0),
      }),
      { total: 0, gym: 0, pool: 0, qalander: 0, gymApproved: 0, poolApproved: 0, qalanderApproved: 0 }
    );
    return [
      ...body,
      {
        faculty: "Total",
        total: sum.total.toLocaleString(),
        gym: fmtApprovedApplied(sum.gymApproved, sum.gym),
        pool: fmtApprovedApplied(sum.poolApproved, sum.pool),
        qalander: fmtApprovedApplied(sum.qalanderApproved, sum.qalander),
        share: memberships.total > 0 ? "100%" : "—",
      },
    ];
  }, [facultyRows, memberships.total]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((row) => ({
          ...facultyBarChartRow(row.faculty),
          gym: row.gymApproved ?? 0,
          pool: row.poolApproved ?? 0,
          qalander: row.qalanderApproved ?? 0,
        })),
    [facultyRows]
  );

  const typeDistribution = useMemo(
    () =>
      [
        { label: "Gym", value: memberships.gymApproved, color: KPI_COLOR_HEX.indigo },
        { label: "Pool", value: memberships.poolApproved, color: KPI_COLOR_HEX.sky },
        { label: "Qalandar", value: memberships.qalanderApproved, color: KPI_COLOR_HEX.amber },
      ].filter((p) => p.value > 0),
    [memberships.gymApproved, memberships.poolApproved, memberships.qalanderApproved]
  );

  const kpis = [
    {
      label: "Approved memberships",
      value: memberships.totalApproved,
      sub: `${memberships.total.toLocaleString()} applied total`,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Gym",
      value: memberships.gymApproved,
      sub: `${memberships.gymApplied.toLocaleString()} applied · ${pct(memberships.gymApproved, memberships.gymApplied)} approved`,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Pool",
      value: memberships.poolApproved,
      sub: `${memberships.poolApplied.toLocaleString()} applied · ${pct(memberships.poolApproved, memberships.poolApplied)} approved`,
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Qalandars club",
      value: memberships.qalanderApproved,
      sub: `${memberships.qalanderApplied.toLocaleString()} applied · ${pct(memberships.qalanderApproved, memberships.qalanderApplied)} approved`,
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
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-2 w-full">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Top faculties · approved memberships
          </h3>
          {facultyChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No faculty membership data</p>
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
                    labelFormatter={facultyTooltipLabel}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  {MEMBERSHIP_SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.fill}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={18}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Memberships by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "total", label: "Total", align: "right" },
            { key: "gym", label: "Gym (approved)", align: "right" },
            { key: "pool", label: "Pool (approved)", align: "right" },
            { key: "qalander", label: "Qalandar (approved)", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

      
    </div>
  );
}
