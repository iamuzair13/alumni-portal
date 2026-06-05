"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ManagementDashboardApiResponse, ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import ManagementSectionA from "@/components/analytics/management/ManagementSectionA";
import ManagementSectionB from "@/components/analytics/management/ManagementSectionB";
import ManagementSectionC from "@/components/analytics/management/ManagementSectionC";
import ManagementSectionD from "@/components/analytics/management/ManagementSectionD";
import { AnalyticsShell } from "@/components/analytics/v2/layout/AnalyticsShell";
import { ExecutiveCommandCenter } from "@/components/analytics/v2/executive/ExecutiveCommandCenter";
import {
  defaultPeriodFilter,
  formatPeriodLabel,
  periodFilterToSearchParams,
  type AnalyticsPeriodFilter,
} from "@/components/analytics/v2/utils/periodFilter";

export default function AnalyticsDashboardClient() {
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<AnalyticsPeriodFilter>(defaultPeriodFilter);

  const periodLabel = formatPeriodLabel(periodFilter);

  const { data: facultyOptions, isLoading: isLoadingFaculties } = useQuery({
    queryKey: ["organization-faculties", "analytics-filter"],
    queryFn: async () => {
      const res = await fetch("/api/organization/faculties", { headers: { accept: "application/json" } });
      const json = (await res.json()) as {
        success?: boolean;
        faculties?: Array<{ id: number; faculty_name: string }>;
      };
      if (!res.ok || !json.success) throw new Error("Failed to load faculties");
      return json.faculties ?? [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: dashboard, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ["analytics-realtime-dashboard", facultyFilter, periodFilter],
    queryFn: async () => {
      const params = periodFilterToSearchParams(periodFilter);
      params.set("facultyId", facultyFilter);
      const res = await fetch(`/api/analytics/realtime-dashboard?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as ManagementDashboardApiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load analytics");
      return json;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: alumniTrends, isLoading: isLoadingTrends } = useQuery({
    queryKey: ["analytics-alumni-trends", "monthly"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/alumni-trends?period=monthly", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load alumni trends");
      return res.json() as Promise<AlumniTrendPoint[]>;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const data = dashboard as ManagementDashboardPayload | undefined;
  const isLoading = isLoadingDashboard || isLoadingTrends;

  return (
    <AnalyticsShell
      facultyFilter={facultyFilter}
      onFacultyChange={setFacultyFilter}
      facultyOptions={facultyOptions ?? []}
      isLoadingFaculties={isLoadingFaculties}
      periodFilter={periodFilter}
      onPeriodFilterChange={setPeriodFilter}
    >
      <ExecutiveCommandCenter data={data} trends={alumniTrends} isLoading={isLoading} />

      <ManagementSectionA data={data} isLoading={isLoadingDashboard} periodLabel={periodLabel} />
      <ManagementSectionB data={data} isLoading={isLoadingDashboard} />
      <ManagementSectionC data={data} isLoading={isLoadingDashboard} />
      <ManagementSectionD data={data} isLoading={isLoadingDashboard} />

      {dashboard?.scopeNotes && dashboard.scopeNotes.length > 0 && (
        <aside className="mt-3 rounded-xl border border-gray-200 bg-white/80 p-3 text-[11px] text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
          <p className="font-semibold text-gray-800 dark:text-gray-200">Data scope</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5">
            {dashboard.scopeNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      )}
    </AnalyticsShell>
  );
}
