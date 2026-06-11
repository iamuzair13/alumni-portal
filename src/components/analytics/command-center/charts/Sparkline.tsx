"use client";

import React from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function Sparkline({
  data,
  color = "#34d399",
  height = 52,
  variant = "default",
}: {
  data: number[];
  color?: string;
  height?: number;
  variant?: "default" | "premium";
}) {
  const series = data.map((value, i) => ({ i, value }));
  const gradientId = `spark-${color.replace("#", "")}`;
  const isPremium = variant === "premium";

  if (!series.length) {
    return (
      <div
        className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/50"
        style={{ height }}
      />
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={isPremium ? 0.28 : 0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={isPremium ? 0.04 : 0.05} />
            </linearGradient>
          </defs>
          <Area
            type={isPremium ? "natural" : "monotone"}
            dataKey="value"
            stroke={color}
            strokeWidth={isPremium ? 2 : 2.5}
            fill={`url(#${gradientId})`}
            isAnimationActive
            animationDuration={isPremium ? 900 : 600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
