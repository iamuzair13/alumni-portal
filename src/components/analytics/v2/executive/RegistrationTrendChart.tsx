"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import {
  CHART_HEIGHT_HERO,
  CHART_HEIGHT_NAV,
  analyticsCard,
  analyticsSectionTitle,
} from "../layout/analyticsTheme";
import {
  CHART_LEGEND_ICON,
  CHART_LEGEND_STYLE,
  formatChartLabel,
  labelStyle,
  tickProps,
} from "../charts/chartDefaults";
import type { RegistrationTrendChartPoint } from "../utils/buildRegistrationTrendChartSeries";

const registrationChartConfig = {
  total: { label: "Total", color: "hsl(239 84% 67%)" },
  verified: { label: "Verified", color: "hsl(160 84% 39%)" },
};

export function RegistrationTrendChart({
  data,
  periodLabel,
  asOfLabel,
  granularity,
  isLoading,
  compact,
  embedded,
  navPreview,
}: {
  data: RegistrationTrendChartPoint[];
  periodLabel: string;
  asOfLabel: string | null;
  granularity: "daily" | "monthly";
  isLoading: boolean;
  compact?: boolean;
  /** Skip outer card — for embedding inside cluster nav tiles */
  embedded?: boolean;
  /** Ultra-compact chart for left nav tiles */
  navPreview?: boolean;
}) {
  const height = navPreview ? CHART_HEIGHT_NAV : compact ? 96 : CHART_HEIGHT_HERO;
  const wrapperClass = embedded ? "" : analyticsCard;

  return (
    <div className={wrapperClass}>
      <div className={`flex items-baseline justify-between gap-2 ${navPreview ? "mb-0" : "mb-1"}`}>
        <h3
          className={
            navPreview
              ? "sr-only"
              : compact
                ? "truncate text-[10px] font-medium text-gray-500 dark:text-gray-400"
                : analyticsSectionTitle
          }
        >
          {compact ? "Registrations" : `Registrations (${periodLabel})`}
        </h3>
        {asOfLabel && !compact && !navPreview ? (
          <span className="shrink-0 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
            Through {asOfLabel}
          </span>
        ) : null}
      </div>

      {data.length >= 1 ? (
        <ChartContainer
          config={registrationChartConfig}
          className="!h-auto w-full"
          style={{ height }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: navPreview ? 4 : compact ? 14 : 24, right: 4, left: 0, bottom: 0 }}
              barGap={2}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-gray-800" />
              <XAxis
                dataKey="label"
                tick={navPreview ? false : tickProps(compact)}
                tickLine={false}
                axisLine={false}
                interval={granularity === "daily" && data.length > 10 ? "preserveStartEnd" : compact ? "preserveStartEnd" : 0}
                hide={compact || navPreview}
              />
              <YAxis
                tick={navPreview ? false : tickProps(compact)}
                tickLine={false}
                axisLine={false}
                width={navPreview ? 0 : compact ? 28 : 36}
                allowDecimals={false}
                hide={navPreview}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as RegistrationTrendChartPoint | undefined;
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md dark:border-gray-700 dark:bg-gray-900">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{row?.period ?? ""}</div>
                      {payload.map((p) => (
                        <div key={p.name} className="tabular-nums text-gray-700 dark:text-gray-300">
                          {p.name}: {Number(p.value ?? 0).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {!compact && !navPreview ? (
                <Legend wrapperStyle={CHART_LEGEND_STYLE} iconSize={CHART_LEGEND_ICON} />
              ) : null}
              <Bar
                dataKey="total"
                name="Total"
                fill="var(--color-total)"
                radius={[3, 3, 0, 0]}
                maxBarSize={navPreview ? 14 : compact ? 18 : 28}
              >
                {!navPreview ? (
                  <LabelList
                    dataKey="total"
                    position="top"
                    formatter={(value: number) => formatChartLabel(value)}
                    className="fill-indigo-600 dark:fill-indigo-400"
                    style={labelStyle(compact)}
                  />
                ) : null}
              </Bar>
              <Bar
                dataKey="verified"
                name="Verified"
                fill="var(--color-verified)"
                radius={[3, 3, 0, 0]}
                maxBarSize={navPreview ? 14 : compact ? 18 : 28}
              >
                {!navPreview ? (
                  <LabelList
                    dataKey="verified"
                    position="top"
                    formatter={(value: number) => formatChartLabel(value)}
                    className="fill-emerald-600 dark:fill-emerald-400"
                    style={labelStyle(compact)}
                  />
                ) : null}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      ) : (
        <p className="py-6 text-center text-xs text-gray-400">{isLoading ? "Loading…" : "No trend data"}</p>
      )}
    </div>
  );
}
