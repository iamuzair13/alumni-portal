"use client";

import React from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import { KpiStrip } from "./KpiStrip";
import { PerformanceScore } from "./PerformanceScore";
import { InsightsPanel } from "./InsightsPanel";
import { buildAllKpiGroups } from "../utils/kpiConfig";
import { deriveInsights } from "../utils/deriveInsights";
import { derivePerformanceScore } from "../utils/derivePerformanceScore";
import { filterTrendsToPeriod } from "../utils/filterTrendsToPeriod";

export function ExecutiveCommandCenter({
  data,
  trends,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  trends: AlumniTrendPoint[] | undefined;
  isLoading: boolean;
}) {
  const scopedTrends = filterTrendsToPeriod(trends, data?.meta);
  const kpiGroups = buildAllKpiGroups(data, scopedTrends);
  const insights = deriveInsights(data);
  const performance = derivePerformanceScore(data);

  return (
    <section className="mb-3" aria-label="Executive command center">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <KpiStrip groups={kpiGroups} isLoading={isLoading} />
        </div>

        <div className="flex flex-col gap-2 xl:col-span-4">
          <PerformanceScore result={performance} compact />
          <InsightsPanel strengths={insights.strengths} weaknesses={insights.weaknesses} compact />
        </div>
      </div>
    </section>
  );
}
