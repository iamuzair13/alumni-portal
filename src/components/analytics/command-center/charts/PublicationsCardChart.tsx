"use client";

import React from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmpty } from "./ChartEmpty";

const COLORS = {
  stories: "#6366F1",
  newsletters: "#14B8A6",
};

const TOTAL_COLOR = "#C7D2FE";
const APPROVED_COLOR = "#6366F1";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function PublicationsCardChart({
  storiesTotal,
  storiesApproved,
  newsletters,
}: {
  storiesTotal: number;
  storiesApproved: number;
  newsletters: number;
}) {
  const hasData = storiesTotal > 0 || newsletters > 0;

  if (!hasData) {
    return <ChartEmpty height={96} variant="premium" message="No publications yet" />;
  }

  const chartData = [
    {
      label: "Stories",
      Total: storiesTotal,
      Approved: storiesApproved,
      approvalPct: storiesTotal > 0 ? Math.round((storiesApproved / storiesTotal) * 100) : 0,
    },
    {
      label: "Newsletters",
      Total: newsletters,
      Approved: newsletters,
      approvalPct: 100,
    },
  ];

  const rows = [
    { label: "Success Stories", approved: storiesApproved, total: storiesTotal, color: COLORS.stories },
    { label: "Newsletters", approved: newsletters, total: newsletters, color: COLORS.newsletters },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* Grouped vertical bar chart — Total vs Approved */}
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
              <linearGradient id="pub-total-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C7D2FE" />
                <stop offset="100%" stopColor="#A5B4FC" />
              </linearGradient>
              <linearGradient id="pub-approved-grad" x1="0" y1="0" x2="0" y2="1">
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
              formatter={(value: number, name: string, entry: { payload?: { approvalPct?: number } }) => {
                if (name === "Approved") {
                  const pct = entry?.payload?.approvalPct ?? 0;
                  return [`${value.toLocaleString()} approved (${pct}%)`, ""];
                }
                return [`${value.toLocaleString()} total`, ""];
              }}
            />
            <Bar dataKey="Total" fill="url(#pub-total-grad)" radius={[3, 3, 0, 0]} isAnimationActive>
              <LabelList
                dataKey="Total"
                position="top"
                formatter={formatCompact}
                style={{ fontSize: 9, fontWeight: 600, fill: "#94A3B8" }}
              />
            </Bar>
            <Bar dataKey="Approved" fill="url(#pub-approved-grad)" radius={[3, 3, 0, 0]} isAnimationActive>
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
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: TOTAL_COLOR }} />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Total</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: APPROVED_COLOR }} />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Approved</span>
        </span>
      </div>

      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800" />

      <div className="flex min-w-0 w-full flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.total > 0 ? row.color : "#CBD5E1" }} />
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {row.label}
            </p>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-900 dark:text-white">
              {row.approved}/{row.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
