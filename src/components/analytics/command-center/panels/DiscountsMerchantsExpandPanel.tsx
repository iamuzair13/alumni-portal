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
import { Bar as BarMini } from "../charts/Bar";
import { Donut } from "../charts/Donut";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapDiscountsMerchants } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

const CATEGORY_SERIES = [
  { key: "dining", label: "Dining", fill: KPI_COLOR_HEX.amber },
  { key: "retail", label: "Retail", fill: KPI_COLOR_HEX.indigo },
  { key: "travel", label: "Travel", fill: KPI_COLOR_HEX.sky },
  { key: "health", label: "Health", fill: KPI_COLOR_HEX.emerald },
  { key: "professional", label: "Professional", fill: KPI_COLOR_HEX.violet },
  { key: "financial", label: "Financial", fill: KPI_COLOR_HEX.rose },
] as const;

function truncateLabel(name: string, max = 16): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function DiscountsMerchantsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const discounts = mapDiscountsMerchants(data);

  const categoryTableRows = useMemo(
    () =>
      [
        ...discounts.categories.map((row) => ({
          category: row.label,
          count: row.value.toLocaleString(),
          share: pct(row.value, discounts.total),
        })),
        {
          category: "Total",
          count: discounts.total.toLocaleString(),
          share: discounts.total > 0 ? "100%" : "—",
        },
      ],
    [discounts]
  );

  const facultyTableRows = useMemo(() => {
    const body = discounts.facultyRows.map((row) => ({
      faculty: row.faculty,
      total: row.total.toLocaleString(),
      dining: row.dining.toLocaleString(),
      retail: row.retail.toLocaleString(),
      travel: row.travel.toLocaleString(),
      health: row.health.toLocaleString(),
      professional: row.professional.toLocaleString(),
      financial: row.financial.toLocaleString(),
      share: pct(row.total, discounts.total),
    }));
    if (!body.length) return body;
    const sum = discounts.facultyRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        dining: acc.dining + row.dining,
        retail: acc.retail + row.retail,
        travel: acc.travel + row.travel,
        health: acc.health + row.health,
        professional: acc.professional + row.professional,
        financial: acc.financial + row.financial,
      }),
      { total: 0, dining: 0, retail: 0, travel: 0, health: 0, professional: 0, financial: 0 }
    );
    return [
      ...body,
      {
        faculty: "Total",
        total: sum.total.toLocaleString(),
        dining: sum.dining.toLocaleString(),
        retail: sum.retail.toLocaleString(),
        travel: sum.travel.toLocaleString(),
        health: sum.health.toLocaleString(),
        professional: sum.professional.toLocaleString(),
        financial: sum.financial.toLocaleString(),
        share: discounts.total > 0 ? "100%" : "—",
      },
    ];
  }, [discounts.facultyRows, discounts.total]);

  const categoryChart = useMemo(
    () =>
      discounts.categories
        .filter((row) => row.value > 0)
        .map((row, i) => ({
          label: row.label,
          value: row.value,
          color: CATEGORY_SERIES[i]?.fill,
        })),
    [discounts.categories]
  );

  const facultyChartData = useMemo(
    () =>
      [...discounts.facultyRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((row) => ({
          faculty: truncateLabel(row.faculty),
          fullName: row.faculty,
          dining: row.dining,
          retail: row.retail,
          travel: row.travel,
          health: row.health,
          professional: row.professional,
          financial: row.financial,
        })),
    [discounts.facultyRows]
  );

  const merchantRows = useMemo(
    () =>
      discounts.merchants.map((m) => ({
        merchant: m.merchant,
        discount: m.discount || "—",
        reference: m.reference || "—",
      })),
    [discounts.merchants]
  );

  const kpis = [
    {
      label: "Total discounts",
      value: discounts.total,
      sub: `Top: ${discounts.topCategory.label}`,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Dining & cafés",
      value: discounts.dining,
      sub: pct(discounts.dining, discounts.total),
      color: KPI_COLOR_HEX.amber,
    },
    {
      label: "Retail & shopping",
      value: discounts.retail,
      sub: pct(discounts.retail, discounts.total),
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "Partner merchants",
      value: discounts.merchantCount,
      sub: "Listed partners",
      color: KPI_COLOR_HEX.emerald,
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
            <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400" title={k.sub}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-1">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Discount mix
          </h3>
          <div className="h-[180px]">
            {categoryChart.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No discount applications</p>
            ) : (
              <Donut data={categoryChart} showLegend minSlicePercent={0.04} />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-2">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Discount categories
          </h3>
          {categoryChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No category data</p>
          ) : (
            <BarMini
              data={categoryChart}
              height={Math.max(140, categoryChart.length * 28)}
              horizontal
              showLabels
            />
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Discount applications by category
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "category", label: "Category" },
            { key: "count", label: "Applications", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={categoryTableRows}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Discounts by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "total", label: "Total", align: "right" },
            { key: "dining", label: "Dining", align: "right" },
            { key: "retail", label: "Retail", align: "right" },
            { key: "travel", label: "Travel", align: "right" },
            { key: "health", label: "Health", align: "right" },
            { key: "professional", label: "Professional", align: "right" },
            { key: "financial", label: "Financial", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={facultyTableRows}
        />
      </section>

      {facultyChartData.length > 0 ? (
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Top faculties · discount categories
          </h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                <XAxis dataKey="faculty" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  labelFormatter={(_label, payload) =>
                    (payload?.[0]?.payload as { fullName?: string })?.fullName ?? _label
                  }
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                {CATEGORY_SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.fill}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Partner merchants
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "merchant", label: "Merchant" },
            { key: "discount", label: "Discount", align: "right" },
            { key: "reference", label: "Reference" },
          ]}
          rows={merchantRows}
        />
      </section>

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Discount counts from alumni benefit applications (
        <a href="/alumni-profile/benefits/merchant-promotions" className="text-violet-600 underline dark:text-violet-400">
          Merchant promotions
        </a>
        ). Partner list is maintained centrally; faculty filters apply to discount applications.
      </p>
    </div>
  );
}
