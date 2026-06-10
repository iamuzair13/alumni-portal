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
import { mapLocation } from "../data/mapPayloadToCards";
import { colorAt } from "@/components/analytics/v2/charts/chartColors";

const VERIFIED_ONLY = { verifiedOnly: true } as const;

const REGION_KEYS = [
  { key: "punjab", label: "Punjab" },
  { key: "islamabad", label: "Islamabad" },
  { key: "kpk", label: "KPK" },
  { key: "sindh", label: "Sindh" },
  { key: "ajk", label: "AJK" },
  { key: "gb", label: "GB" },
  { key: "balochistan", label: "Balochistan" },
  { key: "overseas", label: "Overseas" },
  { key: "other", label: "Other" },
] as const;

const CHART_REGION_KEYS = ["punjab", "sindh", "islamabad", "kpk", "overseas"] as const;

function truncateFaculty(name: string, max = 16): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function rowTotal(r: Record<(typeof REGION_KEYS)[number]["key"], number>): number {
  return REGION_KEYS.reduce((sum, reg) => sum + (r[reg.key] ?? 0), 0);
}

export function LocationExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const location = mapLocation(data, VERIFIED_ONLY);
  const facultyRows = data?.sectionA?.facultyLocationRows ?? [];
  const pl = data?.sectionA?.verifiedProvinceLocation;

  const regionTotals = useMemo(
    () => ({
      punjab: pl?.punjab ?? 0,
      islamabad: pl?.islamabad ?? 0,
      kpk: pl?.kpk ?? 0,
      sindh: pl?.sindh ?? 0,
      ajk: pl?.ajk ?? 0,
      gb: pl?.gb ?? 0,
      balochistan: pl?.balochistan ?? 0,
      overseas: pl?.overseas ?? 0,
      other: pl?.other ?? 0,
    }),
    [pl]
  );

  const grandTotal = rowTotal(regionTotals);

  const tableRows = useMemo(() => {
    const body = facultyRows.map((r) => {
      const total = rowTotal(r);
      return {
        faculty: r.faculty,
        punjab: r.punjab.toLocaleString(),
        islamabad: r.islamabad.toLocaleString(),
        kpk: r.kpk.toLocaleString(),
        sindh: r.sindh.toLocaleString(),
        ajk: r.ajk.toLocaleString(),
        gb: r.gb.toLocaleString(),
        balochistan: r.balochistan.toLocaleString(),
        overseas: r.overseas.toLocaleString(),
        other: r.other.toLocaleString(),
        total: total.toLocaleString(),
        share: pct(total, grandTotal),
      };
    });
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, r) => ({
        punjab: acc.punjab + r.punjab,
        islamabad: acc.islamabad + r.islamabad,
        kpk: acc.kpk + r.kpk,
        sindh: acc.sindh + r.sindh,
        ajk: acc.ajk + r.ajk,
        gb: acc.gb + r.gb,
        balochistan: acc.balochistan + r.balochistan,
        overseas: acc.overseas + r.overseas,
        other: acc.other + r.other,
      }),
      { punjab: 0, islamabad: 0, kpk: 0, sindh: 0, ajk: 0, gb: 0, balochistan: 0, overseas: 0, other: 0 }
    );
    const total = rowTotal(sum);
    return [
      ...body,
      {
        faculty: "Total",
        punjab: sum.punjab.toLocaleString(),
        islamabad: sum.islamabad.toLocaleString(),
        kpk: sum.kpk.toLocaleString(),
        sindh: sum.sindh.toLocaleString(),
        ajk: sum.ajk.toLocaleString(),
        gb: sum.gb.toLocaleString(),
        balochistan: sum.balochistan.toLocaleString(),
        overseas: sum.overseas.toLocaleString(),
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
          faculty: truncateFaculty(r.faculty),
          fullName: r.faculty,
          punjab: r.punjab,
          sindh: r.sindh,
          islamabad: r.islamabad,
          kpk: r.kpk,
          overseas: r.overseas,
        })),
    [facultyRows]
  );

  const topRegions = [...location.chartSeries]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {topRegions.map((r, i) => (
          <div
            key={r.label}
            className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {r.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: r.color ?? colorAt(i) }}>
              {r.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
              {pct(r.value, grandTotal)} of verified
            </p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Verified location by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            ...REGION_KEYS.map((r) => ({ key: r.key, label: r.label, align: "right" as const })),
            { key: "total", label: "Total", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Regional distribution
          </h3>
          <div className="h-[200px]">
            <Donut data={location.chartSeries} showLegend minSlicePercent={0.03} />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Regional counts
          </h3>
          <BarMini data={location.chartSeries} height={200} horizontal showLabels />
        </section>
      </div>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Top faculties · regional breakdown
        </h3>
        {facultyChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No faculty location data</p>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                <XAxis dataKey="faculty" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  labelFormatter={(_label, payload) =>
                    (payload?.[0]?.payload as { fullName?: string })?.fullName ?? _label
                  }
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {CHART_REGION_KEYS.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={REGION_KEYS.find((r) => r.key === key)?.label ?? key}
                    fill={colorAt(i)}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey={key}
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
