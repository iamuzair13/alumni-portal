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
import { Gauge } from "../charts/Gauge";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapTransitionVelocity } from "../data/mapPayloadToCards";
import {
  transitionVelocityChart,
  transitionVelocityEarlyCount,
} from "@/components/analytics/v2/utils/chartSeriesBuilders";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

const VERIFIED_ONLY = { verifiedOnly: true } as const;

const TIMING_SERIES = [
  { key: "beforeGraduation", label: "Before grad", fill: KPI_COLOR_HEX.emerald },
  { key: "immediateAfterGraduation", label: "Immediate", fill: KPI_COLOR_HEX.sky },
  { key: "within3Months", label: "≤3 mo", fill: KPI_COLOR_HEX.violet },
  { key: "within6Months", label: "≤6 mo", fill: KPI_COLOR_HEX.amber },
  { key: "after6Months", label: ">6 mo", fill: KPI_COLOR_HEX.orange },
  { key: "unknown", label: "Other", fill: KPI_COLOR_HEX.slate },
] as const;

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function earlyCount(r: {
  beforeGraduation: number;
  immediateAfterGraduation: number;
  within3Months: number;
}): number {
  return r.beforeGraduation + r.immediateAfterGraduation + r.within3Months;
}

function trackedTotal(r: {
  beforeGraduation: number;
  immediateAfterGraduation: number;
  within3Months: number;
  within6Months: number;
  after6Months: number;
  unknown: number;
}): number {
  return (
    r.beforeGraduation +
    r.immediateAfterGraduation +
    r.within3Months +
    r.within6Months +
    r.after6Months +
    r.unknown
  );
}

export function VelocityExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const velocity = mapTransitionVelocity(data, VERIFIED_ONLY);
  const facultyRows = data?.sectionA?.facultyTransitionRows ?? [];
  const tv = data?.sectionA?.verifiedTransitionVelocity;
  const verifiedTotal = data?.alumniHeadline?.verified ?? 0;
  const early = transitionVelocityEarlyCount(tv);
  const chartMeta = transitionVelocityChart(tv, verifiedTotal);

  const bucketTotals = useMemo(
    () => ({
      beforeGraduation: tv?.beforeGraduation ?? 0,
      immediateAfterGraduation: tv?.immediateAfterGraduation ?? 0,
      within3Months: tv?.within3Months ?? 0,
      within6Months: tv?.within6Months ?? 0,
      after6Months: tv?.after6Months ?? 0,
      unknown: tv?.unknown ?? 0,
    }),
    [tv]
  );

  const tracked = trackedTotal(bucketTotals);

  const tableRows = useMemo(() => {
    const body = facultyRows.map((r) => {
      const earlyN = earlyCount(r);
      const denom = trackedTotal(r);
      return {
        faculty: r.faculty,
        beforeGraduation: r.beforeGraduation.toLocaleString(),
        immediateAfterGraduation: r.immediateAfterGraduation.toLocaleString(),
        within3Months: r.within3Months.toLocaleString(),
        within6Months: r.within6Months.toLocaleString(),
        after6Months: r.after6Months.toLocaleString(),
        unknown: r.unknown.toLocaleString(),
        early: earlyN.toLocaleString(),
        earlyRate: pct(earlyN, denom),
      };
    });
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, r) => ({
        beforeGraduation: acc.beforeGraduation + r.beforeGraduation,
        immediateAfterGraduation: acc.immediateAfterGraduation + r.immediateAfterGraduation,
        within3Months: acc.within3Months + r.within3Months,
        within6Months: acc.within6Months + r.within6Months,
        after6Months: acc.after6Months + r.after6Months,
        unknown: acc.unknown + r.unknown,
      }),
      {
        beforeGraduation: 0,
        immediateAfterGraduation: 0,
        within3Months: 0,
        within6Months: 0,
        after6Months: 0,
        unknown: 0,
      }
    );
    const earlySum = earlyCount(sum);
    return [
      ...body,
      {
        faculty: "Total",
        beforeGraduation: sum.beforeGraduation.toLocaleString(),
        immediateAfterGraduation: sum.immediateAfterGraduation.toLocaleString(),
        within3Months: sum.within3Months.toLocaleString(),
        within6Months: sum.within6Months.toLocaleString(),
        after6Months: sum.after6Months.toLocaleString(),
        unknown: sum.unknown.toLocaleString(),
        early: earlySum.toLocaleString(),
        earlyRate: pct(earlySum, tracked),
      },
    ];
  }, [facultyRows, tracked]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .map((r) => ({ ...r, early: earlyCount(r) }))
        .filter((r) => trackedTotal(r) > 0)
        .sort((a, b) => b.early - a.early)
        .slice(0, 8)
        .map((r) => ({
          ...facultyBarChartRow(r.faculty),
          beforeGraduation: r.beforeGraduation,
          immediateAfterGraduation: r.immediateAfterGraduation,
          within3Months: r.within3Months,
          within6Months: r.within6Months,
          after6Months: r.after6Months,
          unknown: r.unknown,
        })),
    [facultyRows]
  );

  const kpis = [
    { label: "Early transition", value: `${velocity.score}%`, sub: `${early.toLocaleString()} alumni`, color: KPI_COLOR_HEX.emerald },
    { label: "Before graduation", value: bucketTotals.beforeGraduation, sub: pct(bucketTotals.beforeGraduation, tracked), color: KPI_COLOR_HEX.emerald },
    { label: "Grad", value: bucketTotals.immediateAfterGraduation, sub: pct(bucketTotals.immediateAfterGraduation, tracked), color: KPI_COLOR_HEX.sky },
    { label: "Within 3 months", value: bucketTotals.within3Months, sub: pct(bucketTotals.within3Months, tracked), color: KPI_COLOR_HEX.violet },
    { label: "Tracked responses", value: tracked, sub: pct(tracked, verifiedTotal) + " of verified", color: KPI_COLOR_HEX.slate },
  ];

  const timingChartSeries = chartMeta.chartSeries.filter((p) => p.label !== "Not provided");

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
              {typeof k.value === "number" ? k.value.toLocaleString() : k.value}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>


      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Top faculties · transition breakdown
        </h3>
        {facultyChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No faculty transition data</p>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                <XAxis dataKey="faculty" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  labelFormatter={facultyTooltipLabel}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {TIMING_SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.fill} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                    <LabelList dataKey={s.key} position="top" fontSize={7} fontWeight={600} fill="#6b7280" formatter={(v: number) => (v > 0 ? v.toLocaleString() : "")} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Transition timing by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "beforeGraduation", label: "Before grad", align: "right" },
            { key: "immediateAfterGraduation", label: "Grad", align: "right" },
            { key: "within3Months", label: "≤3 mo", align: "right" },
            { key: "within6Months", label: "≤6 mo", align: "right" },
            { key: "after6Months", label: ">6 mo", align: "right" },
            { key: "unknown", label: "Other", align: "right" },
            { key: "early", label: "Early", align: "right" },
            { key: "earlyRate", label: "Early %", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>


    </div>
  );
}
