"use client";

import React, { useMemo, useState } from "react";
import type { KpiConfigGroup } from "../utils/kpiConfig";
import { resolveSectionClusters } from "../utils/sectionClusters";
import {
  analyticsDetailPanel,
  analyticsNavPanel,
  analyticsSplitContainer,
} from "../layout/analyticsTheme";
import { ClusterNavItem } from "./ClusterNavItem";
import { ClusterDetailPanel } from "./ClusterDetailPanel";
import type { RegistrationTrendChartPoint } from "../utils/buildRegistrationTrendChartSeries";

function NavSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-[148px] animate-pulse rounded-xl border border-gray-200/60 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/60"
        />
      ))}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 md:p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-gray-200/60 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/60"
        />
      ))}
    </div>
  );
}

export function DashboardSplitView({
  groups,
  isLoading,
  registrationTrend,
  periodLabel,
  asOfLabel,
  granularity,
}: {
  groups: KpiConfigGroup[];
  isLoading?: boolean;
  registrationTrend: {
    points: RegistrationTrendChartPoint[];
    asOfLabel: string | null;
    granularity: "daily" | "monthly";
  };
  periodLabel: string;
  asOfLabel: string | null;
  granularity: "daily" | "monthly";
}) {
  const clusters = useMemo(() => resolveSectionClusters(groups), [groups]);
  const [selectedClusterId, setSelectedClusterId] = useState("section-1");

  const selectedCluster =
    clusters.find((c) => c.id === selectedClusterId) ?? clusters[0];

  if (isLoading) {
    return (
      <div className={analyticsSplitContainer}>
        <div className={analyticsNavPanel}>
          <NavSkeleton />
        </div>
        <div className={analyticsDetailPanel}>
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={analyticsSplitContainer}>
      <nav className={analyticsNavPanel} aria-label="Analytics sections">
        {clusters.map((cluster) => (
          <ClusterNavItem
            key={cluster.id}
            cluster={cluster}
            selected={cluster.id === selectedCluster?.id}
            onSelect={() => setSelectedClusterId(cluster.id)}
            registrationTrend={cluster.id === "section-1" ? registrationTrend : undefined}
            periodLabel={periodLabel}
            granularity={granularity}
            isLoading={isLoading}
          />
        ))}
      </nav>

      <div className={analyticsDetailPanel}>
        <ClusterDetailPanel
          cluster={selectedCluster}
          registrationTrend={registrationTrend}
          periodLabel={periodLabel}
          asOfLabel={asOfLabel}
          granularity={granularity}
          isLoading={!!isLoading}
        />
      </div>
    </div>
  );
}
