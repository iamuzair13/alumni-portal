"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ManagementDashboardApiResponse, ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import {
  defaultPeriodFilter,
  periodFilterToSearchParams,
  type AnalyticsPeriodFilter,
} from "@/components/analytics/v2/utils/periodFilter";

export function useCommandCenterData() {
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<AnalyticsPeriodFilter>(defaultPeriodFilter);

  const facultiesQuery = useQuery({
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

  const dashboardQuery = useQuery({
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
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const trendsQuery = useQuery({
    queryKey: ["analytics-alumni-trends", "monthly"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/alumni-trends?period=monthly", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load alumni trends");
      return res.json() as Promise<AlumniTrendPoint[]>;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const data = dashboardQuery.data as ManagementDashboardPayload | undefined;
  const scopeNotes = dashboardQuery.data?.scopeNotes;
  const isLoading = dashboardQuery.isLoading || trendsQuery.isLoading;
  const dataUpdatedAt = Math.max(dashboardQuery.dataUpdatedAt, trendsQuery.dataUpdatedAt);

  return {
    facultyFilter,
    setFacultyFilter,
    periodFilter,
    setPeriodFilter,
    facultyOptions: facultiesQuery.data ?? [],
    isLoadingFaculties: facultiesQuery.isLoading,
    data,
    scopeNotes,
    trends: trendsQuery.data,
    isLoading,
    dataUpdatedAt,
  };
}
