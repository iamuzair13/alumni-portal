"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { Donut } from "./Donut";
import { ChartEmpty } from "./ChartEmpty";

const LEGEND_ROW = 15;
const LEGEND_PAD = 8;

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function CategoriesCardChart({ data }: { data: ChartSeriesPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [donutSize, setDonutSize] = useState(96);
  const filtered = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const legendHeight = filtered.length * LEGEND_ROW + LEGEND_PAD;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const availH = Math.max(72, height - legendHeight);
      const next = Math.floor(Math.min(width, availH) * 0.98);
      if (next > 0) setDonutSize(Math.max(80, Math.min(next, 118)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filtered.length, legendHeight]);

  if (!filtered.length) {
    return <ChartEmpty height={88} message="No category data" />;
  }

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const sorted = [...filtered].sort((a, b) => b.value - a.value);

  return (
    <div ref={containerRef} className="flex h-full w-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Donut data={sorted} size={donutSize} minSlicePercent={0.04} />
      </div>

      <ul className="shrink-0 space-y-1 border-t border-emerald-100/80 pt-1 dark:border-emerald-500/10">
        {sorted.map((tier) => {
          const pct = total > 0 ? Math.round((tier.value / total) * 100) : 0;
          return (
            <li
              key={tier.label}
              className="flex items-center gap-1.5 text-[10px] leading-tight text-gray-600 dark:text-gray-400"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tier.color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-700 dark:text-gray-300">
                {tier.label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-gray-800 dark:text-gray-200">
                {formatCount(tier.value)}
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-gray-500 dark:text-gray-400">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function categoriesSummary(data: ChartSeriesPoint[]): string {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return "Verified alumni tiers";

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const top = [...filtered].sort((a, b) => b.value - a.value)[0];
  if (!top || total <= 0) return "Verified alumni tiers";

  const pct = Math.round((top.value / total) * 100);
  return `Verified · ${top.label} leads at ${pct}%`;
}
