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
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapAlumniCategories } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

const VERIFIED_ONLY = { verifiedOnly: true } as const;

const TIER_SERIES = [
  { key: "aPlus", label: "A+", fill: KPI_COLOR_HEX.violet },
  { key: "a", label: "A", fill: KPI_COLOR_HEX.sky },
  { key: "b", label: "B", fill: KPI_COLOR_HEX.orange },
  { key: "c", label: "C", fill: KPI_COLOR_HEX.slate },
  { key: "d", label: "D", fill: KPI_COLOR_HEX.rose },
] as const;

function truncateFaculty(name: string, max = 20): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function rowTotal(r: { aPlus: number; a: number; b: number; c: number; d: number }): number {
  return r.aPlus + r.a + r.b + r.c + r.d;
}

export function CategoriesExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const categories = mapAlumniCategories(data, VERIFIED_ONLY);
  const facultyRows = data?.sectionA?.facultyCategoryRows ?? [];
  const cat = data?.alumniHeadline?.verifiedCategory;

  const tierTotals = useMemo(
    () => ({
      aPlus: cat?.aPlus ?? 0,
      a: cat?.a ?? 0,
      b: cat?.b ?? 0,
      c: cat?.c ?? 0,
      d: cat?.d ?? 0,
    }),
    [cat]
  );

  const grandTotal = tierTotals.aPlus + tierTotals.a + tierTotals.b + tierTotals.c + tierTotals.d;

  const tableRows = useMemo(() => {
    const body = facultyRows.map((r) => {
      const total = rowTotal(r);
      return {
        faculty: r.faculty,
        aPlus: r.aPlus.toLocaleString(),
        a: r.a.toLocaleString(),
        b: r.b.toLocaleString(),
        c: r.c.toLocaleString(),
        d: r.d.toLocaleString(),
        total: total.toLocaleString(),
        share: pct(total, grandTotal),
      };
    });
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, r) => ({
        aPlus: acc.aPlus + r.aPlus,
        a: acc.a + r.a,
        b: acc.b + r.b,
        c: acc.c + r.c,
        d: acc.d + r.d,
      }),
      { aPlus: 0, a: 0, b: 0, c: 0, d: 0 }
    );
    const total = rowTotal(sum);
    return [
      ...body,
      {
        faculty: "Total",
        aPlus: sum.aPlus.toLocaleString(),
        a: sum.a.toLocaleString(),
        b: sum.b.toLocaleString(),
        c: sum.c.toLocaleString(),
        d: sum.d.toLocaleString(),
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
          faculty: truncateFaculty(r.faculty),
          fullName: r.faculty,
          aPlus: r.aPlus,
          a: r.a,
          b: r.b,
          c: r.c,
          d: r.d,
        })),
    [facultyRows]
  );

  const kpis = [
    { label: "A+", value: tierTotals.aPlus, color: KPI_COLOR_HEX.violet },
    { label: "A", value: tierTotals.a, color: KPI_COLOR_HEX.sky },
    { label: "B", value: tierTotals.b, color: KPI_COLOR_HEX.orange },
    { label: "C", value: tierTotals.c, color: KPI_COLOR_HEX.slate },
    { label: "D", value: tierTotals.d, color: KPI_COLOR_HEX.rose },
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
              Tier {k.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: k.color }}>
              {(k.value ?? 0).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              {pct(k.value ?? 0, grandTotal)} of verified
            </p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Verified categories by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "aPlus", label: "A+", align: "right" },
            { key: "a", label: "A", align: "right" },
            { key: "b", label: "B", align: "right" },
            { key: "c", label: "C", align: "right" },
            { key: "d", label: "D", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Tier distribution
          </h3>
          <div className="h-[200px]">
            <Donut data={categories.chartSeries} showLabels showLegend minSlicePercent={0.04} />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            All tiers · verified alumni
          </h3>
          <BarMini data={categories.chartSeries} height={200} horizontal={false} showLabels />
        </section>
      </div>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Top faculties · tier breakdown
        </h3>
        {facultyChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No faculty category data</p>
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
                  labelFormatter={(_label, payload) =>
                    (payload?.[0]?.payload as { fullName?: string })?.fullName ?? _label
                  }
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {TIER_SERIES.map((s) => (
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
    </div>
  );
}
