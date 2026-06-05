"use client";

import React from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import { Area, AreaChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { KpiStrip } from "./KpiStrip";
import { PerformanceScore } from "./PerformanceScore";
import { InsightsPanel } from "./InsightsPanel";
import { buildAllKpiGroups } from "../utils/kpiConfig";
import { deriveInsights } from "../utils/deriveInsights";
import { derivePerformanceScore } from "../utils/derivePerformanceScore";
import { filterTrendsToPeriod } from "../utils/filterTrendsToPeriod";

function RegistrationTrendChart({
  data,
  periodLabel,
  isLoading,
  compact = false,
}: {
  data: Array<{ period: string; total: number; verified: number; active: number }>;
  periodLabel: string;
  isLoading: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50 ${
        compact ? "px-2.5 py-2" : "p-3"
      }`}
    >
      <p
        className={`font-bold uppercase tracking-wider text-gray-900 dark:text-white ${
          compact ? "mb-1 text-[9px]" : "mb-2 text-[11px]"
        }`}
      >
        Registration trend ({periodLabel})
      </p>
      {data.length >= 2 ? (
        <div className={compact ? "h-[72px]" : "h-[100px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="period"
                tick={{ fontSize: compact ? 8 : 9 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip contentStyle={{ fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                name="Total"
              />
              <Area
                type="monotone"
                dataKey="verified"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.1}
                strokeWidth={1.5}
                dot={false}
                name="Verified"
              />
            </AreaChart>
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
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  trends: AlumniTrendPoint[] | undefined;
  isLoading: boolean;
}) {
  const scopedTrends = filterTrendsToPeriod(trends, data?.meta);
  const kpiGroups = buildAllKpiGroups(data, scopedTrends);
  const insights = deriveInsights(data);
  const performance = derivePerformanceScore(data);

  const periodLabel = data?.meta?.timeRange ?? "Selected period";
  const trendChartData = scopedTrends.slice(-12).map((p) => ({
    period: p.period,
    total: p.total,
    verified: p.verified,
    active: p.active,
  }));

  return (
    <section className="mb-3" aria-label="Executive command center">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <KpiStrip groups={kpiGroups} isLoading={isLoading} />
        </div>

        <div className="flex flex-col gap-2 xl:col-span-4">
          <PerformanceScore result={performance} compact />
          <RegistrationTrendChart data={trendChartData} periodLabel={periodLabel} isLoading={isLoading} compact />
          <InsightsPanel strengths={insights.strengths} weaknesses={insights.weaknesses} compact />
        </div>
      </div>
    </section>
  );
}
