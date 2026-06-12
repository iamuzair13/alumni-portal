"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { Donut } from "./Donut";
import { ChartEmpty } from "./ChartEmpty";

const CHART_GAP = 6;

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function CategoriesCardChart({ data }: { data: ChartSeriesPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLUListElement>(null);
  const [donutSize, setDonutSize] = useState(88);
  const filtered = useMemo(() => data.filter((d) => d.value > 0), [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      const legendH = legendRef.current?.getBoundingClientRect().height ?? 0;
      const availH = Math.max(56, height - legendH - CHART_GAP);
      const next = Math.floor(Math.min(width - 4, availH) * 0.92);
      if (next > 0) setDonutSize(Math.max(64, Math.min(next, 104)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    if (legendRef.current) ro.observe(legendRef.current);
    return () => ro.disconnect();
  }, [filtered.length]);

  if (!filtered.length) {
    return <ChartEmpty height={88} message="No category data" />;
  }

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const sorted = [...filtered].sort((a, b) => b.value - a.value);

  return (
    <div ref={containerRef} className="flex h-full w-full min-h-0 flex-col justify-between gap-1">
      <div className="flex shrink-0 items-center justify-center py-0.5">
        <Donut data={sorted} size={donutSize} minSlicePercent={0.04} />
      </div>

      <ul
        ref={legendRef}
        className="flex justify-between shrink-0 space-y-0.5 border-t border-emerald-100/80 pt-1 dark:border-emerald-500/10"
      >
        {sorted.map((tier) => {
          const pct = total > 0 ? Math.round((tier.value / total) * 100) : 0;
          return (
            
            <li
              key={tier.label}
              className="flex  items-center gap-1.5 text-[9px] leading-tight text-gray-600 dark:text-gray-400"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tier.color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-700 dark:text-gray-300">
                {tier.label} - {formatCount(tier.value)} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

