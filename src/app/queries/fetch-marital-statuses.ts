"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type MaritalStatusOption = {
  value: string;
  label: string;
  count: number;
};

export type MaritalStatusesResponse = {
  success: boolean;
  maritalStatuses: MaritalStatusOption[];
};

async function getMaritalStatuses(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<MaritalStatusesResponse> {
  const url = new URL("/api/alumni/marital-statuses", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-marital-statuses] API error:", res.status, err);
    throw new Error(err || "Failed to fetch marital statuses");
  }
  
  const data = (await res.json()) as MaritalStatusesResponse;
  console.log("[fetch-marital-statuses] Received data:", data);
  return data;
}

export function useMaritalStatuses(filters?: MasterFilters) {
  return useQuery<MaritalStatusesResponse, Error>({
    queryKey: ["marital-statuses", filters],
    queryFn: ({ signal }) => getMaritalStatuses(signal, filters),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
  });
}

