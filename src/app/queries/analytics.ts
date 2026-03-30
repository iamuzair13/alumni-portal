"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsModule, AnalyticsPeriod, AnalyticsSeries, DashboardAnalytics } from "@/lib/analytics/types";

export type AnalyticsQueryInput = {
  module: AnalyticsModule;
  period: AnalyticsPeriod;
};

export const analyticsKey = (input: AnalyticsQueryInput) => ["analytics", input.module, input.period] as const;

export async function getAnalytics(input: AnalyticsQueryInput): Promise<AnalyticsSeries | DashboardAnalytics> {
  const params = new URLSearchParams();
  params.set("module", input.module);
  params.set("period", input.period);
  const res = await fetch(`/api/analytics?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Failed to fetch analytics");
  return data as AnalyticsSeries | DashboardAnalytics;
}

export function useAnalytics(input: AnalyticsQueryInput, enabled: boolean = true) {
  return useQuery({
    queryKey: analyticsKey(input),
    queryFn: () => getAnalytics(input),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

