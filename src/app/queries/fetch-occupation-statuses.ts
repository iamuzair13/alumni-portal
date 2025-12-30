"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type OccupationStatusOption = {
  value: string;
  label: string;
  count: number;
};

export type OccupationStatusesResponse = {
  success: boolean;
  occupationStatuses: OccupationStatusOption[];
};

async function getOccupationStatuses(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<OccupationStatusesResponse> {
  const url = new URL("/api/alumni/occupation-statuses", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-occupation-statuses] API error:", res.status, err);
    throw new Error(err || "Failed to fetch occupation statuses");
  }
  
  const data = (await res.json()) as OccupationStatusesResponse;
  console.log("[fetch-occupation-statuses] Received data:", data);
  return data;
}

export function useOccupationStatuses(filters?: MasterFilters) {
  return useQuery<OccupationStatusesResponse, Error>({
    queryKey: ["occupation-statuses", filters],
    queryFn: ({ signal }) => getOccupationStatuses(signal, filters),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}

