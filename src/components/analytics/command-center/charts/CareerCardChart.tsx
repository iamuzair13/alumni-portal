"use client";

import React from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmpty } from "./ChartEmpty";

const UOL_COLOR = "#6366F1";
const OTHER_COLOR = "#14B8A6";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function CareerCardChart({
  total,
  uol,
  other,
}: {
  total: number;
  uol: number;
  other: number;
}) {
  if (total === 0 && uol === 0 && other === 0) {
    return <ChartEmpty height={96} variant="premium" message="No jobs posted yet" />;
  }

  const denom = Math.max(uol + other, 1);

  const chartData = [
    { label: "UOL", value: uol, pct: Math.round((uol / denom) * 100), color: UOL_COLOR },
    { label: "Other", value: other, pct: Math.round((other / denom) * 100), color: OTHER_COLOR },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* Vertical bar chart — UOL vs Other */}
      <div className="w-full" style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 18, right: 6, bottom: 0, left: 6 }}
            barCategoryGap="30%"
            maxBarSize={36}
          >
            <defs>
              <linearGradient id="jobs-uol-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
              <linearGradient id="jobs-other-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#14B8A6" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(99,102,241,0.06)" }}
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#fff",
              }}
              formatter={(value: number, name: string, entry: { payload?: { pct?: number } }) => [
                `${value.toLocaleString()} jobs (${entry?.payload?.pct ?? 0}%)`,
                name,
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive>
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.label}
                  fill={i === 0 ? "url(#jobs-uol-grad)" : "url(#jobs-other-grad)"}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={formatCompact}
                style={{ fontSize: 10, fontWeight: 700, fill: "#334155" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-0.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: UOL_COLOR }} />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">UOL</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: OTHER_COLOR }} />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Other</span>
        </span>
      </div>

      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800" />

      <div className="flex min-w-0 w-full flex-col gap-1.5">
        {chartData.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.value > 0 ? row.color : "#CBD5E1" }} />
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-300">{row.label}</p>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-900 dark:text-white">
              {row.value.toLocaleString()}
            </span>
            <span className="shrink-0 text-[10px] text-slate-400">({row.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
