"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import {
  PRIMARY_METRICS,
  CATEGORY_SEGMENTS,
  MEDAL_SEGMENTS,
  STAT_COLOR_THEMES,
  buildSparklineSeries,
  computeTrendDelta,
  type DashboardTabKey,
} from "./dashboard-stats-config";
import { KpiCard } from "@/components/design-system/KpiCard";
import { Card } from "@/components/design-system/Card";
import { SectionHeader } from "@/components/design-system/SectionHeader";
import { StatTile } from "@/components/design-system/StatTile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type DashboardStatsCounts = {
  total: number;
  verified: number;
  underApproval: number;
  active: number;
  category: {
    aPlus: number;
    a: number;
    b: number;
    c: number;
    d: number;
    distinguished: number;
  };
  medal: {
    gold: number;
    silver: number;
    bronze: number;
  };
};

function useAnimatedCounter(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = target;
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

function UnderApprovalContent({
  newCount,
  changeCount,
  isLoadingNew,
  isLoadingChange,
}: {
  newCount: number;
  changeCount: number;
  isLoadingNew: boolean;
  isLoadingChange: boolean;
}) {
  const animatedNew = useAnimatedCounter(isLoadingNew ? 0 : newCount);
  const animatedChange = useAnimatedCounter(isLoadingChange ? 0 : changeCount);

  if (isLoadingNew && isLoadingChange) {
    return <div className="mt-1 h-8 w-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />;
  }

  return (
    <p className="text-2xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
      <span className="inline-flex items-center gap-2">
        <span className="rounded-md bg-gray-50 px-2 py-0.5 ring-1 ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700/60">
          {isLoadingNew ? "…" : animatedNew.toLocaleString()}
        </span>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="rounded-md bg-gray-50 px-2 py-0.5 ring-1 ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700/60">
          {isLoadingChange ? "…" : animatedChange.toLocaleString()}
        </span>
      </span>
    </p>
  );
}

export type DashboardStatsProps = {
  selected: DashboardTabKey;
  onSelect: (key: DashboardTabKey) => void;
  counts: DashboardStatsCounts;
  isLoadingCounts: boolean;
  underApprovalChangeCount: number;
  isLoadingChangeCount: boolean;
};

async function fetchAlumniTrends(): Promise<AlumniTrendPoint[]> {
  const res = await fetch("/api/dashboard/alumni-trends?period=monthly", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to load alumni trends");
  }
  return res.json() as Promise<AlumniTrendPoint[]>;
}

function getMetricValue(key: DashboardTabKey, counts: DashboardStatsCounts): number {
  switch (key) {
    case "total":
      return counts.total;
    case "verified":
      return counts.verified;
    case "underApproval":
      return counts.underApproval;
    case "active":
      return counts.active;
    case "distinguished":
      return counts.category.distinguished;
    case "goldMedalist":
      return counts.medal.gold;
    case "silverMedalist":
      return counts.medal.silver;
    case "bronzeMedalist":
      return counts.medal.bronze;
    case "aPlus":
      return counts.category.aPlus;
    case "a":
      return counts.category.a;
    case "b":
      return counts.category.b;
    case "c":
      return counts.category.c;
    case "d":
      return counts.category.d;
    default:
      return 0;
  }
}

export function DashboardStats({
  selected,
  onSelect,
  counts,
  isLoadingCounts,
  underApprovalChangeCount,
  isLoadingChangeCount,
}: DashboardStatsProps) {
  const { data: trendPoints = [] } = useQuery({
    queryKey: ["dashboard-alumni-trends-sparkline"],
    queryFn: fetchAlumniTrends,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const sparklinesByKey = useMemo(() => {
    const map: Partial<Record<DashboardTabKey, number[]>> = {};
    for (const metric of PRIMARY_METRICS) {
      if (!metric.sparklineKey) continue;
      map[metric.key] = buildSparklineSeries(trendPoints, metric.sparklineKey);
    }
    return map;
  }, [trendPoints]);

  const categoryTotal = counts.category.aPlus + counts.category.a + counts.category.b + counts.category.c + counts.category.d;
  const medalTotal = counts.medal.gold + counts.medal.silver + counts.medal.bronze;

  const categoryDotColors: Record<string, string> = {
    aPlus: "bg-violet-500",
    a: "bg-blue-500",
    b: "bg-emerald-500",
    c: "bg-amber-500",
    d: "bg-slate-500",
  };

  const medalDotColors: Record<string, string> = {
    goldMedalist: "bg-yellow-500",
    silverMedalist: "bg-gray-400",
    bronzeMedalist: "bg-orange-500",
  };

  const categoryValueByKey: Record<string, number> = {
    aPlus: counts.category.aPlus,
    a: counts.category.a,
    b: counts.category.b,
    c: counts.category.c,
    d: counts.category.d,
  };

  const medalValueByKey: Record<string, number> = {
    goldMedalist: counts.medal.gold,
    silverMedalist: counts.medal.silver,
    bronzeMedalist: counts.medal.bronze,
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Dashboard statistics">
      {/* KPI Section */}
      <div
        className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5"
        role="tablist"
        aria-label="Primary alumni metrics"
      >
        {PRIMARY_METRICS.map((metric) => {
          const value = getMetricValue(metric.key, counts);
          const sparkline = sparklinesByKey[metric.key];
          const trend = sparkline ? computeTrendDelta(sparkline) : undefined;
          const isSelected = selected === metric.key;
          const Icon = metric.icon;
          const theme = STAT_COLOR_THEMES[metric.color];

          if (metric.key === "underApproval") {
            return (
              <KpiCard
                key={metric.key}
                label={metric.label}
                value={value}
                isLoading={isLoadingCounts}
                isSelected={isSelected}
                onClick={() => onSelect(metric.key)}
                icon={Icon}
                badge={metric.badge?.label}
                accentBorder={theme.border}
                accentIconChip={theme.iconChip}
                accentIconColor={theme.icon}
                aria-label={`${metric.label} (${counts.underApproval.toLocaleString()} new | ${underApprovalChangeCount.toLocaleString()} changes)`}
              >
                <UnderApprovalContent
                  newCount={counts.underApproval}
                  changeCount={underApprovalChangeCount}
                  isLoadingNew={isLoadingCounts}
                  isLoadingChange={isLoadingChangeCount}
                />
              </KpiCard>
            );
          }

          return (
            <KpiCard
              key={metric.key}
              label={metric.label}
              value={value}
              isLoading={isLoadingCounts}
              isSelected={isSelected}
              onClick={() => onSelect(metric.key)}
              icon={Icon}
              sparkline={sparkline}
              sparklineColor={theme.spark}
              trend={trend}
              badge={!trend ? metric.badge?.label : undefined}
              accentBorder={theme.border}
              accentIconChip={theme.iconChip}
              accentIconColor={theme.icon}
            />
          );
        })}
      </div>

      {/* Secondary breakdowns: Categories + Medalists side by side */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <Card size="sm" className="p-3">
          <SectionHeader
            title="Alumni Categories"
            description="Distribution by grade category"
            actions={
              <span className="text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">
                {categoryTotal.toLocaleString()} total
              </span>
            }
          />
          <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {CATEGORY_SEGMENTS.map((seg) => (
              <Tooltip key={seg.key}>
                <TooltipTrigger asChild>
                  <div>
                    <StatTile
                      label={seg.label}
                      value={categoryValueByKey[seg.key] ?? 0}
                      total={categoryTotal || 1}
                      isSelected={selected === seg.key}
                      onClick={() => onSelect(seg.key)}
                      dotColor={categoryDotColors[seg.key]}
                      barColor={categoryDotColors[seg.key]}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{seg.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </Card>

        <Card size="sm" className="p-3">
          <SectionHeader
            title="Medalists"
            description="Distribution by medal type"
            actions={
              <span className="text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">
                {medalTotal.toLocaleString()} total
              </span>
            }
          />
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {MEDAL_SEGMENTS.map((seg) => (
              <Tooltip key={seg.key}>
                <TooltipTrigger asChild>
                  <div>
                    <StatTile
                      label={seg.label}
                      value={medalValueByKey[seg.key] ?? 0}
                      total={medalTotal || 1}
                      isSelected={selected === seg.key}
                      onClick={() => onSelect(seg.key)}
                      dotColor={medalDotColors[seg.key]}
                      barColor={medalDotColors[seg.key]}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{seg.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
