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
import { mapHonorCards } from "../data/mapPayloadToCards";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import { facultyBarChartRow, facultyTooltipLabel } from "../utils/facultyLabels";

const VERIFIED_ONLY = { verifiedOnly: true } as const;

const STATUS_SERIES = [
  { key: "applied", label: "Applied", fill: KPI_COLOR_HEX.slate },
  { key: "review", label: "Review", fill: KPI_COLOR_HEX.amber },
  { key: "onHold", label: "On hold", fill: KPI_COLOR_HEX.rose },
  { key: "underPrinting", label: "Printing", fill: KPI_COLOR_HEX.sky },
  { key: "readyForDelivery", label: "Ready", fill: KPI_COLOR_HEX.indigo },
  { key: "delivered", label: "Delivered", fill: KPI_COLOR_HEX.emerald },
] as const;

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function rowTotal(r: {
  applied: number;
  review: number;
  onHold: number;
  underPrinting: number;
  readyForDelivery: number;
  delivered: number;
}): number {
  return r.applied + r.review + r.onHold + r.underPrinting + r.readyForDelivery + r.delivered;
}

function inPipeline(r: {
  applied: number;
  review: number;
  onHold: number;
  underPrinting: number;
  readyForDelivery: number;
}): number {
  return r.applied + r.review + r.onHold + r.underPrinting + r.readyForDelivery;
}

export function HonorExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const honor = mapHonorCards(data, VERIFIED_ONLY);
  const facultyRows = data?.sectionB?.facultyHonorCardRows ?? [];
  const cards = data?.sectionB?.verifiedCardsStatus;

  const statusTotals = useMemo(
    () => ({
      applied: cards?.applied ?? 0,
      review: cards?.review ?? 0,
      onHold: cards?.onHold ?? 0,
      underPrinting: cards?.underPrinting ?? 0,
      readyForDelivery: cards?.readyForDelivery ?? 0,
      delivered: cards?.delivered ?? 0,
    }),
    [cards]
  );

  const grandTotal = rowTotal(statusTotals);
  const pipeline = inPipeline(statusTotals);
  const deliveryRate = grandTotal > 0 ? Math.round((statusTotals.delivered / grandTotal) * 100) : 0;

  const tableRows = useMemo(() => {
    const body = facultyRows.map((r) => {
      const total = rowTotal(r);
      return {
        faculty: r.faculty,
        applied: r.applied.toLocaleString(),
        review: r.review.toLocaleString(),
        onHold: r.onHold.toLocaleString(),
        underPrinting: r.underPrinting.toLocaleString(),
        readyForDelivery: r.readyForDelivery.toLocaleString(),
        delivered: r.delivered.toLocaleString(),
        total: total.toLocaleString(),
        share: pct(total, grandTotal),
        deliveryRate: pct(r.delivered, total),
      };
    });
    if (!body.length) return body;
    const sum = facultyRows.reduce(
      (acc, r) => ({
        applied: acc.applied + r.applied,
        review: acc.review + r.review,
        onHold: acc.onHold + r.onHold,
        underPrinting: acc.underPrinting + r.underPrinting,
        readyForDelivery: acc.readyForDelivery + r.readyForDelivery,
        delivered: acc.delivered + r.delivered,
      }),
      { applied: 0, review: 0, onHold: 0, underPrinting: 0, readyForDelivery: 0, delivered: 0 }
    );
    const total = rowTotal(sum);
    return [
      ...body,
      {
        faculty: "Total",
        applied: sum.applied.toLocaleString(),
        review: sum.review.toLocaleString(),
        onHold: sum.onHold.toLocaleString(),
        underPrinting: sum.underPrinting.toLocaleString(),
        readyForDelivery: sum.readyForDelivery.toLocaleString(),
        delivered: sum.delivered.toLocaleString(),
        total: total.toLocaleString(),
        share: "100%",
        deliveryRate: pct(sum.delivered, total),
      },
    ];
  }, [facultyRows, grandTotal]);

  const facultyChartData = useMemo(
    () =>
      [...facultyRows]
        .filter((r) => rowTotal(r) > 0)
        .sort((a, b) => b.delivered - a.delivered)
        .slice(0, 8)
        .map((r) => ({
          ...facultyBarChartRow(r.faculty),
          applied: r.applied,
          review: r.review,
          onHold: r.onHold,
          underPrinting: r.underPrinting,
          readyForDelivery: r.readyForDelivery,
          delivered: r.delivered,
        })),
    [facultyRows]
  );

  const chartSeries = honor.chartSeries.filter((p) => p.value > 0);

  const kpis = [
    {
      label: "Delivered",
      value: statusTotals.delivered,
      sub: pct(statusTotals.delivered, grandTotal) + " of cards",
      color: KPI_COLOR_HEX.emerald,
    },
    {
      label: "Pending",
      value: pipeline,
      sub: pct(pipeline, grandTotal) + " pending",
      color: KPI_COLOR_HEX.amber,
    },
    {
      label: "Delivery rate",
      value: `${deliveryRate}%`,
      sub: "Verified alumni",
      color: KPI_COLOR_HEX.sky,
    },
    {
      label: "Total cards",
      value: grandTotal,
      sub: `${(data?.alumniHeadline?.verified ?? 0).toLocaleString()} verified`,
      color: KPI_COLOR_HEX.slate,
    },
    {
      label: "Ready",
      value: statusTotals.readyForDelivery,
      sub: pct(statusTotals.readyForDelivery, grandTotal),
      color: KPI_COLOR_HEX.indigo,
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
              {typeof k.value === "number" ? k.value.toLocaleString() : k.value}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Top faculties · honor card pipeline
        </h3>
        {facultyChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No faculty honor card data</p>
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
                {STATUS_SERIES.map((s) => (
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
          Honor cards by faculty
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "onHold", label: "On hold", align: "right" },
            { key: "review", label: "Review", align: "right" },
            { key: "underPrinting", label: "Printing", align: "right" },
            { key: "readyForDelivery", label: "Ready", align: "right" },
            { key: "delivered", label: "Delivered", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "deliveryRate", label: "Delivered %", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={tableRows}
        />
      </section>

    
    </div>
  );
}
