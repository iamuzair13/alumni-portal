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
import { ChapterVerticalBarChart } from "../charts/ChapterVerticalBarChart";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapDiscountsMerchants } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

const CATEGORY_META = [
  { key: "dining", label: "Dining & cafés", kpiLabel: "Dining & cafés", fill: KPI_COLOR_HEX.amber },
  { key: "retail", label: "Retail", kpiLabel: "Retail & shopping", fill: KPI_COLOR_HEX.indigo },
  { key: "travel", label: "Travel", kpiLabel: "Travel & leisure", fill: KPI_COLOR_HEX.sky },
  { key: "health", label: "Health", kpiLabel: "Health & wellness", fill: KPI_COLOR_HEX.emerald },
  { key: "professional", label: "Professional", kpiLabel: "Professional", fill: KPI_COLOR_HEX.violet },
  { key: "financial", label: "Financial", kpiLabel: "Financial", fill: KPI_COLOR_HEX.rose },
] as const;

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function hasMerchantData(m: { merchant: string; discount: string; reference: string }): boolean {
  const discount = String(m.discount ?? "").trim();
  const reference = String(m.reference ?? "").trim();
  return (
    Boolean(String(m.merchant ?? "").trim()) &&
    ((discount.length > 0 && discount !== "—") || (reference.length > 0 && reference !== "—"))
  );
}

export function DiscountsMerchantsExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const discounts = mapDiscountsMerchants(data);

  const activeCategories = useMemo(
    () => discounts.categories.filter((row) => row.value > 0),
    [discounts.categories]
  );

  const activeFacultyRows = useMemo(
    () => discounts.facultyRows.filter((row) => row.total > 0),
    [discounts.facultyRows]
  );

  const categoryTableRows = useMemo(() => {
    const body = activeCategories.map((row) => ({
      category: row.label,
      count: row.value.toLocaleString(),
      share: pct(row.value, discounts.total),
    }));
    if (!body.length) return body;
    return [
      ...body,
      {
        category: "Total",
        count: discounts.total.toLocaleString(),
        share: discounts.total > 0 ? "100%" : "—",
      },
    ];
  }, [activeCategories, discounts.total]);

  const activeCategorySeries = useMemo(
    () =>
      CATEGORY_META.filter((series) =>
        activeFacultyRows.some((row) => Number(row[series.key as keyof typeof row] ?? 0) > 0)
      ),
    [activeFacultyRows]
  );

  const facultyTableColumns = useMemo(
    () => [
      { key: "faculty", label: "Faculty" },
      { key: "total", label: "Total", align: "right" as const },
      ...activeCategorySeries.map((series) => ({
        key: series.key,
        label: series.label,
        align: "right" as const,
      })),
      { key: "share", label: "Share", align: "right" as const },
    ],
    [activeCategorySeries]
  );

  const facultyTableRows = useMemo(() => {
    type FacultyRow = (typeof activeFacultyRows)[number];

    const buildRow = (faculty: string, row: FacultyRow, share: string) => {
      const entry: Record<string, string> = {
        faculty,
        total: row.total.toLocaleString(),
        share,
      };
      for (const series of activeCategorySeries) {
        const value = Number(row[series.key as keyof FacultyRow] ?? 0);
        if (value > 0) {
          entry[series.key] = value.toLocaleString();
        }
      }
      return entry;
    };

    const body = activeFacultyRows.map((row) =>
      buildRow(row.faculty, row, pct(row.total, discounts.total))
    );
    if (!body.length) return body;

    const sum = activeFacultyRows.reduce(
      (acc, row) => ({
        faculty: "Total",
        total: acc.total + row.total,
        dining: acc.dining + row.dining,
        retail: acc.retail + row.retail,
        travel: acc.travel + row.travel,
        health: acc.health + row.health,
        professional: acc.professional + row.professional,
        financial: acc.financial + row.financial,
      }),
      { faculty: "Total", total: 0, dining: 0, retail: 0, travel: 0, health: 0, professional: 0, financial: 0 }
    );

    return [
      ...body,
      buildRow("Total", sum as FacultyRow, discounts.total > 0 ? "100%" : "—"),
    ];
  }, [activeFacultyRows, activeCategorySeries, discounts.total]);

  const categoryChart = useMemo(
    () =>
      [...activeCategories]
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map((row, i) => {
          const meta = CATEGORY_META.find((c) => c.key === row.key);
          return {
            label: row.label,
            fullName: meta?.kpiLabel ?? row.label,
            value: row.value,
            color: i === 0 ? KPI_COLOR_HEX.violet : meta?.fill,
          };
        }),
    [activeCategories]
  );

  const facultyChartData = useMemo(
    () =>
      [...activeFacultyRows]
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((row) => ({
          ...facultyBarChartRow(row.faculty),
          dining: row.dining,
          retail: row.retail,
          travel: row.travel,
          health: row.health,
          professional: row.professional,
          financial: row.financial,
        })),
    [activeFacultyRows]
  );

  const merchantRows = useMemo(
    () =>
      discounts.merchants.filter(hasMerchantData).map((m) => ({
        merchant: m.merchant,
        discount: m.discount || "—",
        reference: m.reference || "—",
      })),
    [discounts.merchants]
  );

  const kpis = useMemo(
    () =>
      [
        {
          label: "Total discounts",
          value: discounts.total,
          sub: activeCategories.length > 0 ? `Top: ${discounts.topCategory.label}` : "No applications",
          color: KPI_COLOR_HEX.violet,
        },
        ...CATEGORY_META.map((meta) => ({
          label: meta.kpiLabel,
          value: discounts[meta.key as keyof typeof discounts] as number,
          sub: pct(discounts[meta.key as keyof typeof discounts] as number, discounts.total),
          color: meta.fill,
        })),
        {
          label: "Partner merchants",
          value: merchantRows.length,
          sub: "Listed partners",
          color: KPI_COLOR_HEX.emerald,
        },
      ].filter((k) => k.value > 0),
    [discounts, activeCategories.length, merchantRows.length]
  );

  return (
    <div className="space-y-5">
      {kpis.length > 0 ? (
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
      ) : null}

      <div className="flex ">
        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
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

        <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Top discount categories
          </h3>
          {categoryChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No discount applications</p>
          ) : (
            <ChapterVerticalBarChart
              data={categoryChart}
              accent="violet"
              height={475}
              valueLabel="Applications"
            />
          )}
        </section>
      </div>

      {activeFacultyRows.length > 0 ? (
        <div className="flex ">
          <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Discounts by faculty
            </h3>
            <p className="mb-3 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
              Each row counts alumni merchant-promotion applications, grouped by the applicant&apos;s faculty.
              Categories are inferred from the application&apos;s discount type and respect your dashboard faculty
              filters.
            </p>
            <AnalyticsDataTable
              isLoading={isLoading}
              columns={facultyTableColumns}
              rows={facultyTableRows}
            />
          </section>

          {facultyChartData.length > 0 && activeCategorySeries.length > 0 ? (
            <section className="w-full rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Top faculties · discount categories
              </h3>
              <div className="h-[475px] w-full">
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
                    <YAxis
                      tick={{ fontSize: 9, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 10 }}
                      labelFormatter={facultyTooltipLabel}
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    {activeCategorySeries.map((s) => (
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
        </div>
      ) : null}

      {merchantRows.length > 0 ? (
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
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
      ) : null}

      
    </div>
  );
}
