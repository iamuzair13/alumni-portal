"use client";
import { useQuery } from "@tanstack/react-query";

export type MaritalStatusOption = {
  value: string;
  label: string;
  count: number;
};

export type MaritalStatusesResponse = {
  success: boolean;
  maritalStatuses: MaritalStatusOption[];
};

async function getMaritalStatuses(signal?: AbortSignal): Promise<MaritalStatusesResponse> {
  const url = "/api/alumni/marital-statuses";
  const res = await fetch(url, { 
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

export function useMaritalStatuses() {
  return useQuery<MaritalStatusesResponse, Error>({
    queryKey: ["marital-statuses"],
    queryFn: ({ signal }) => getMaritalStatuses(signal),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
  });
}

