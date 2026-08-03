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

export type ScholarshipCardRow = {
  type: string;
  short: string;
  applied: number;
  approved: number;
  color: string;
};

const SLICE_COLORS: Record<string, string> = {
  "Masters / PhD": "#6366F1",
  "Kinship": "#14B8A6",
};
const FALLBACK_COLORS = ["#6366F1", "#14B8A6", "#F59E0B", "#10B981", "#94A3B8"];

const APPLIED_COLOR = "#C7D2FE";
const APPROVED_COLOR = "#6366F1";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function ScholarshipsCardChart({
  rows,
  total,
}: {
  rows: ScholarshipCardRow[];
  total: number;
}) {
  if (total === 0 && rows.every((r) => r.applied === 0)) {
    return <ChartEmpty height={96} variant="premium" message="No scholarship data" />;
  }

  const activeRows = rows.filter((r) => r.applied > 0 || r.approved > 0);
  const chartData =
    activeRows.length > 0
      ? activeRows.map((r) => ({
          label: r.short || r.type,
          fullName: r.type,
          Applied: r.applied,
          Approved: r.approved,
          approvalPct: r.applied > 0 ? Math.round((r.approved / r.applied) * 100) : 0,
        }))
      : [{ label: "Approved", fullName: "Approved", Applied: 0, Approved: total, approvalPct: 100 }];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* Grouped vertical bar chart — Applied vs Approved */}
      <div className="w-full" style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 18, right: 6, bottom: 0, left: 6 }}
            barCategoryGap="25%"
            barGap={2}
            maxBarSize={28}
          >
            <defs>
              <linearGradient id="scholarship-applied-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C7D2FE" />
                <stop offset="100%" stopColor="#A5B4FC" />
              </linearGradient>
              <linearGradient id="scholarship-approved-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#6366F1" />
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
              formatter={(value: number, name: string, entry: { payload?: { approvalPct?: number; fullName?: string } }) => {
                if (name === "Approved") {
                  const pct = entry?.payload?.approvalPct ?? 0;
                  return [`${value.toLocaleString()} approved (${pct}%)`, entry?.payload?.fullName ?? name];
                }
                return [`${value.toLocaleString()} applied`, entry?.payload?.fullName ?? name];
              }}
            />
            <Bar dataKey="Applied" fill="url(#scholarship-applied-grad)" radius={[3, 3, 0, 0]} isAnimationActive>
              <LabelList
                dataKey="Applied"
                position="top"
                formatter={formatCompact}
                style={{ fontSize: 9, fontWeight: 600, fill: "#94A3B8" }}
              />
            </Bar>
            <Bar dataKey="Approved" fill="url(#scholarship-approved-grad)" radius={[3, 3, 0, 0]} isAnimationActive>
              <LabelList
                dataKey="Approved"
                position="top"
                formatter={formatCompact}
                style={{ fontSize: 9, fontWeight: 700, fill: "#6366F1" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-0.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: APPLIED_COLOR }} />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Applied</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: APPROVED_COLOR }} />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Approved</span>
        </span>
      </div>

      {/* Divider */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800" />

      {/* Breakdown list */}
      <div className="flex min-w-0 w-full flex-col gap-1.5">
        {rows.map((row) => {
          const color = SLICE_COLORS[row.type] ?? "#94A3B8";
          const hasActivity = row.applied > 0 || row.approved > 0;
          return (
            <div key={row.type} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: hasActivity ? color : "#CBD5E1" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {row.type}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-900 dark:text-white">
                {row.approved}/{row.applied}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
