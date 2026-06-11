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

const MEMBERSHIP_SERIES = [
  { key: "gym", label: "Gym", fill: KPI_COLOR_HEX.indigo },
  { key: "pool", label: "Pool", fill: KPI_COLOR_HEX.sky },
  { key: "qalander", label: "Qalandar", fill: KPI_COLOR_HEX.amber },
] as const;

function truncateFaculty(name: string, max = 16): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
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
      gym: row.gym.toLocaleString(),
      pool: row.pool.toLocaleString(),
      qalander: row.qalander.toLocaleString(),
      share: pct(row.total, memberships.total),
    }));
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        gym: acc.gym + row.gym,
        pool: acc.pool + row.pool,
        qalander: acc.qalander + row.qalander,
      }),
      { total: 0, gym: 0, pool: 0, qalander: 0 }
    );
    return [
      ...body,
      {
        faculty: "Total",
        total: sum.total.toLocaleString(),
        gym: sum.gym.toLocaleString(),
        pool: sum.pool.toLocaleString(),
        qalander: sum.qalander.toLocaleString(),
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
          faculty: truncateFaculty(row.faculty),
          fullName: row.faculty,
          gym: row.gym,
          pool: row.pool,
          qalander: row.qalander,
        })),
    [facultyRows]
  );

  const typeDistribution = useMemo(
    () =>
      [
        { label: "Gym", value: memberships.gym, color: KPI_COLOR_HEX.indigo },
        { label: "Pool", value: memberships.pool, color: KPI_COLOR_HEX.sky },
        { label: "Qalandar", value: memberships.qalander, color: KPI_COLOR_HEX.amber },
      ].filter((p) => p.value > 0),
    [memberships.gym, memberships.pool, memberships.qalander]
  );

  const kpis = [
    {
      label: "Total memberships",
      value: memberships.total,
      sub: "All applications",
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Gym",
      value: memberships.gym,
      sub: pct(memberships.gym, memberships.total) + " of total",
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Pool",
      value: memberships.pool,
      sub: pct(memberships.pool, memberships.total) + " of total",
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Qalandars club",
      value: memberships.qalander,
      sub: pct(memberships.qalander, memberships.total) + " of total",
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

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Memberships by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "total", label: "Total", align: "right" },
            { key: "gym", label: "Gym", align: "right" },
            { key: "pool", label: "Pool", align: "right" },
            { key: "qalander", label: "Qalandar", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-1">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Membership mix
          </h3>
          <div className="h-[180px]">
            {typeDistribution.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No membership data</p>
            ) : (
              <Donut data={typeDistribution} showLegend minSlicePercent={0.04} />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-2">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Top faculties · membership types
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
                    labelFormatter={(_label, payload) =>
                      (payload?.[0]?.payload as { fullName?: string })?.fullName ?? _label
                    }
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
      </div>
    </div>
  );
}
