"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import {
  PRIMARY_METRICS,
  buildSparklineSeries,
  computeTrendDelta,
  type DashboardTabKey,
} from "./dashboard-stats-config";
import { StatCard, UnderApprovalMetricContent } from "./StatCard";
import { AlumniCategoryCard } from "./AlumniCategoryCard";

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
};

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

  return (
    <section className="flex flex-col gap-3 px-1" aria-label="Dashboard statistics">
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

          if (metric.key === "underApproval") {
            return (
              <StatCard
                key={metric.key}
                label={metric.label}
                value={value}
                isLoading={isLoadingCounts}
                isSelected={isSelected}
                onClick={() => onSelect(metric.key)}
                icon={Icon}
                color={metric.color}
                badge={metric.badge?.label}
                aria-label={`${metric.label} (${counts.underApproval.toLocaleString()} new | ${underApprovalChangeCount.toLocaleString()} changes)`}
              >
                <UnderApprovalMetricContent
                  newCount={counts.underApproval}
                  changeCount={underApprovalChangeCount}
                  isLoadingNew={isLoadingCounts}
                  isLoadingChange={isLoadingChangeCount}
                />
              </StatCard>
            );
          }

          return (
            <StatCard
              key={metric.key}
              label={metric.label}
              value={value}
              isLoading={isLoadingCounts}
              isSelected={isSelected}
              onClick={() => onSelect(metric.key)}
              icon={Icon}
              color={metric.color}
              sparkline={sparkline}
              trend={trend}
              badge={!trend ? metric.badge?.label : undefined}
            />
          );
        })}
      </div>

      <AlumniCategoryCard
        selected={selected}
        onSelect={onSelect}
        counts={{
          aPlus: counts.category.aPlus,
          a: counts.category.a,
          b: counts.category.b,
          c: counts.category.c,
          d: counts.category.d,
        }}
        isLoading={isLoadingCounts}
      />
    </section>
  );
}
