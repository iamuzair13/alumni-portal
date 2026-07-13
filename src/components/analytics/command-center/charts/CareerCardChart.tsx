"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmpty } from "./ChartEmpty";

const UOL_COLOR = "#6366F1";
const OTHER_COLOR = "#14B8A6";

type OutsideLabelProps = {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  name: string;
  value: number;
  pct: number;
};

function OutsideLabel({ cx, cy, midAngle, outerRadius, name, value, pct }: OutsideLabelProps) {
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
      <line x1={cx + lineStart * cos} y1={cy + lineStart * sin} x2={cx + lineEnd * cos} y2={cy + lineEnd * sin} stroke="#94A3B8" strokeWidth={1} />
      <text x={textX} y={textY - 6} textAnchor={anchor} fill="#334155" fontSize={11} fontWeight={600}>{name}</text>
      <text x={textX} y={textY + 7} textAnchor={anchor} fill="#6366F1" fontSize={12} fontWeight={700}>
        {value.toLocaleString()} <tspan fill="#94A3B8" fontSize={10} fontWeight={500}>({pct}%)</tspan>
      </text>
    </g>
  );
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

  const pieData = [
    { name: "UOL", value: uol, pct: Math.round((uol / denom) * 100), color: UOL_COLOR },
    { name: "Other", value: other, pct: Math.round((other / denom) * 100), color: OTHER_COLOR },
  ].filter((d) => d.value > 0);

  const rows = [
    { label: "UOL", value: uol, pct: Math.round((uol / denom) * 100), color: UOL_COLOR },
    { label: "Other", value: other, pct: Math.round((other / denom) * 100), color: OTHER_COLOR },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
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
                    value={slice?.value ?? 0}
                    pct={slice?.pct ?? 0}
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
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800" />

      <div className="flex min-w-0 w-full flex-col gap-1.5">
        {rows.map((row) => (
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
