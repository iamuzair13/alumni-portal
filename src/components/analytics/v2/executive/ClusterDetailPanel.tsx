"use client";

import React from "react";
import { CollapsibleKpiSection } from "./CollapsibleKpiSection";
import { RegistrationTrendChart } from "./RegistrationTrendChart";
import {
  analyticsDetailGrid,
  analyticsSectionDesc,
  analyticsSectionTitle,
} from "../layout/analyticsTheme";
import type { ResolvedSectionCluster } from "../utils/sectionClusters";
import type { RegistrationTrendChartPoint } from "../utils/buildRegistrationTrendChartSeries";

export function ClusterDetailPanel({
  cluster,
  registrationTrend,
  periodLabel,
  asOfLabel,
  granularity,
  isLoading,
}: {
  cluster: ResolvedSectionCluster | undefined;
  registrationTrend?: {
    points: RegistrationTrendChartPoint[];
    asOfLabel: string | null;
    granularity: "daily" | "monthly";
  };
  periodLabel: string;
  asOfLabel: string | null;
  granularity: "daily" | "monthly";
  isLoading: boolean;
}) {
  if (!cluster) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Select a section
      </div>
    );
  }

  const showRegistration = cluster.id === "section-1" && registrationTrend;

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200/80 pb-3 dark:border-gray-800">
        <h2 className={`${analyticsSectionTitle} text-lg`}>{cluster.label}</h2>
        {cluster.insight ? (
          <p className={`mt-1 ${analyticsSectionDesc}`}>{cluster.insight}</p>
        ) : null}
      </div>

      <div className={analyticsDetailGrid}>
        {showRegistration ? (
          <div className="md:col-span-2">
            <RegistrationTrendChart
              data={registrationTrend.points}
              periodLabel={periodLabel}
              asOfLabel={asOfLabel}
              granularity={granularity}
              isLoading={isLoading}
            />
          </div>
        ) : null}

        {cluster.groups.map((group) => (
          <CollapsibleKpiSection key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
