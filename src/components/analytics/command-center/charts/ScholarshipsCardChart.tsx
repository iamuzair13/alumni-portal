"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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

type OutsideLabelProps = {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  name: string;
  approved: number;
  approvalPct: number;
};

function OutsideLabel({ cx, cy, midAngle, outerRadius, name, approved, approvalPct }: OutsideLabelProps) {
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);

  const lineStart = outerRadius + 4;
  const lineEnd = outerRadius + 18;
  const textX = cx + (lineEnd + 4) * cos;
  const textY = cy + (lineEnd + 4) * sin;
  const anchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <line
        x1={cx + lineStart * cos}
        y1={cy + lineStart * sin}
        x2={cx + lineEnd * cos}
        y2={cy + lineEnd * sin}
        stroke="#94A3B8"
        strokeWidth={1}
      />
      <text
        x={textX}
        y={textY - 6}
        textAnchor={anchor}
        fill="#334155"
        fontSize={11}
        fontWeight={600}
      >
        {name}
      </text>
      <text
        x={textX}
        y={textY + 7}
        textAnchor={anchor}
        fill="#6366F1"
        fontSize={12}
        fontWeight={700}
      >
        {approved} <tspan fill="#94A3B8" fontSize={10} fontWeight={500}>({approvalPct}%)</tspan>
      </text>
    </g>
  );
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
  const pieData =
    activeRows.length > 0
      ? activeRows.map((r, i) => ({
          name: r.short || r.type,
          fullName: r.type,
          value: r.applied,
          approved: r.approved,
          approvalPct: r.applied > 0 ? Math.round((r.approved / r.applied) * 100) : 0,
          color: SLICE_COLORS[r.type] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        }))
      : [{ name: "Approved", fullName: "Approved", value: total, approved: total, approvalPct: 100, color: "#6366F1" }];

  const grandTotal = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* Donut — full width so outside labels have room on both sides */}
      <div className="w-full" style={{ height: 88 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 6, right: 40, bottom: 6, left: 40 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={24}
              outerRadius={40}
              paddingAngle={3}
              stroke="none"
              labelLine={false}
              label={(props) => {
                const slice = pieData[props.index];
                return (
                  <OutsideLabel
                    cx={props.cx}
                    cy={props.cy}
                    midAngle={props.midAngle}
                    outerRadius={props.outerRadius}
                    name={props.name}
                    approved={slice?.approved ?? 0}
                    approvalPct={slice?.approvalPct ?? 0}
                  />
                );
              }}
            >
              {pieData.map((entry, i) => (
                <Cell key={`${entry.name}-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
              formatter={(value: number, name: string, entry: { payload?: { approved?: number; approvalPct?: number } }) => [
                `${entry?.payload?.approved ?? 0} approved / ${value} applied (${entry?.payload?.approvalPct ?? 0}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Divider */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800" />

      {/* Breakdown list — unchanged labels */}
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
