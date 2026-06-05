"use client";

import React from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiStrip } from "./KpiStrip";
import { PerformanceScore } from "./PerformanceScore";
import { InsightsPanel } from "./InsightsPanel";
import { buildAllKpiGroups } from "../utils/kpiConfig";
import { deriveInsights } from "../utils/deriveInsights";
import { derivePerformanceScore } from "../utils/derivePerformanceScore";
import { filterTrendsToPeriod } from "../utils/filterTrendsToPeriod";
import {
  buildRegistrationTrendChartSeries,
  type RegistrationTrendChartPoint,
} from "../utils/buildRegistrationTrendChartSeries";

function RegistrationTrendChart({
  data,
  periodLabel,
  asOfLabel,
  granularity,
  isLoading,
  compact = false,
}: {
  data: RegistrationTrendChartPoint[];
  periodLabel: string;
  asOfLabel: string | null;
  granularity: "daily" | "monthly";
  isLoading: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50 ${
        compact ? "px-2.5 py-2" : "p-3"
      }`}
    >
      <div className={`flex items-baseline justify-between gap-2 ${compact ? "mb-1" : "mb-2"}`}>
        <p
          className={`font-bold uppercase tracking-wider text-gray-900 dark:text-white ${
            compact ? "text-[9px]" : "text-[11px]"
          }`}
        >
          Registrations ({periodLabel})
        </p>
        {asOfLabel ? (
          <span className="shrink-0 text-[9px] tabular-nums text-gray-400 dark:text-gray-500">Through {asOfLabel}</span>
        ) : null}
      </div>
      {compact ? (
        <div className="mb-1 flex gap-2 text-[9px] text-gray-400 dark:text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-sm bg-indigo-500" />
            Total
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500" />
            Verified
          </span>
        </div>
      ) : null}
      {data.length >= 1 ? (
        <div className={compact ? "h-[88px]" : "h-[120px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: compact ? 14 : 18, right: 2, left: -18, bottom: 0 }} barGap={1} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-gray-800" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: compact ? 7 : 8 }}
                tickLine={false}
                axisLine={false}
                interval={granularity === "daily" && data.length > 8 ? "preserveStartEnd" : 0}
              />
              <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 10 }}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as RegistrationTrendChartPoint | undefined;
                  return row?.period ?? "";
                }}
              />
              {!compact ? <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} iconSize={8} /> : null}
              <Bar dataKey="total" name="Total" fill="#6366f1" radius={[2, 2, 0, 0]} maxBarSize={compact ? 14 : 18}>
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(value: number) => (value > 0 ? value.toLocaleString() : "")}
                  className="fill-indigo-600 dark:fill-indigo-400"
                  style={{ fontSize: compact ? 7 : 8, fontWeight: 600 }}
                />
              </Bar>
              <Bar dataKey="verified" name="Verified" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={compact ? 14 : 18}>
                <LabelList
                  dataKey="verified"
                  position="top"
                  formatter={(value: number) => (value > 0 ? value.toLocaleString() : "")}
                  className="fill-emerald-600 dark:fill-emerald-400"
                  style={{ fontSize: compact ? 7 : 8, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={`text-center text-gray-400 ${compact ? "py-4 text-[10px]" : "py-6 text-xs"}`}>
          {isLoading ? "Loading…" : "No trend data"}
        </p>
      )}
    </div>
  );
}

export function ExecutiveCommandCenter({
  data,
  trends,
  dailyTrends,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  trends: AlumniTrendPoint[] | undefined;
  dailyTrends: AlumniTrendPoint[] | undefined;
  isLoading: boolean;
}) {
  const scopedTrends = filterTrendsToPeriod(trends, data?.meta);
  const kpiGroups = buildAllKpiGroups(data, scopedTrends);
  const insights = deriveInsights(data);
  const performance = derivePerformanceScore(data);

  const periodLabel = data?.meta?.timeRange ?? "Selected period";
  const trendSeries = buildRegistrationTrendChartSeries(dailyTrends, trends, data?.meta);

  return (
    <section className="mb-3" aria-label="Executive command center">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <KpiStrip groups={kpiGroups} isLoading={isLoading} />
        </div>

        <div className="flex flex-col gap-2 xl:col-span-4">
          <PerformanceScore result={performance} compact />
          <RegistrationTrendChart
            data={trendSeries.points}
            periodLabel={periodLabel}
            asOfLabel={trendSeries.asOfLabel}
            granularity={trendSeries.granularity}
            isLoading={isLoading}
            compact
          />
          <InsightsPanel strengths={insights.strengths} weaknesses={insights.weaknesses} compact />
        </div>
      </div>
    </section>
  );
}
