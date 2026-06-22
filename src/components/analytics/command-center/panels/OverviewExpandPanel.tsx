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
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapAlumniOverview } from "../data/mapPayloadToCards";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

const SERIES = {
  total: { key: "total", label: "Total", fill: "#6366f1" },
  verified: { key: "verified", label: "Verified", fill: "#10b981" },
  active: { key: "active", label: "Active", fill: "#34d399" },
} as const;

export function OverviewExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const overview = mapAlumniOverview(data);
  const facultyRows = data?.sectionA?.facultyRows ?? [];

  const totals = useMemo(
    () =>
      facultyRows.reduce(
        (acc, r) => ({
          registrations: acc.registrations + (r.registrations ?? 0),
          verified: acc.verified + (r.verified ?? 0),
          active: acc.active + (r.active ?? 0),
        }),
        { registrations: 0, verified: 0, active: 0 }
      ),
    [facultyRows]
  );

  const tableRows = useMemo(() => {
    const body = facultyRows.map((r) => ({
      faculty: r.faculty,
      registrations: (r.registrations ?? 0).toLocaleString(),
      verified: (r.verified ?? 0).toLocaleString(),
      active: (r.active ?? 0).toLocaleString(),
      verifyRate: pct(r.verified ?? 0, r.registrations ?? 0),
      activeRate: pct(r.active ?? 0, r.registrations ?? 0),
    }));
    if (!body.length) return body;
    return [
      ...body,
      {
        faculty: "Total",
        registrations: totals.registrations.toLocaleString(),
        verified: totals.verified.toLocaleString(),
        active: totals.active.toLocaleString(),
        verifyRate: pct(totals.verified, totals.registrations),
        activeRate: pct(totals.active, totals.registrations),
      },
    ];
  }, [facultyRows, totals]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .sort((a, b) => b.registrations - a.registrations)
        .slice(0, 8)
        .map((r) => ({
          ...facultyBarChartRow(r.faculty),
          total: r.registrations ?? 0,
          verified: r.verified ?? 0,
          active: r.active ?? 0,
        })),
    [facultyRows]
  );

  const kpis = [
    {
      label: "Total alumni",
      value: overview.primaryValue,
      sub: "All registered",
      accent: "from-indigo-500/15 to-indigo-500/5 border-indigo-200/80 dark:border-indigo-500/20",
      text: "text-indigo-700 dark:text-indigo-300",
    },
    {
      label: "Verified",
      value: (data?.alumniHeadline?.verified ?? 0).toLocaleString(),
      sub: pct(data?.alumniHeadline?.verified ?? 0, Number(overview.primaryValue) || 0) + " of total",
      accent: "from-emerald-500/15 to-emerald-500/5 border-emerald-200/80 dark:border-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Active",
      value: (data?.kpis?.activeAlumni ?? 0).toLocaleString(),
      sub: pct(data?.kpis?.activeAlumni ?? 0, Number(overview.primaryValue) || 0) + " of total",
      accent: "from-teal-500/15 to-teal-500/5 border-teal-200/80 dark:border-teal-500/20",
      text: "text-teal-700 dark:text-teal-300",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border bg-gradient-to-br px-4 py-3 ${k.accent}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {k.label}
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${k.text}`}>
              {typeof k.value === "number" ? k.value.toLocaleString() : k.value}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>
      <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Top faculties · total vs verified vs active
          </h3>
          {facultyChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No faculty data</p>
          ) : (
            <div className="h-[200px] w-full">
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
                  <YAxis
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 10 }}
                    labelFormatter={facultyTooltipLabel}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {Object.values(SERIES).map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.fill}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey={s.key}
                        position="top"
                        fontSize={8}
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
          Faculty breakdown
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "registrations", label: "Total", align: "right" },
            { key: "verified", label: "Verified", align: "right" },
            { key: "active", label: "Active", align: "right" },
            { key: "verifyRate", label: "Verify %", align: "right" },
            { key: "activeRate", label: "Active %", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

      
    </div>
  );
}
