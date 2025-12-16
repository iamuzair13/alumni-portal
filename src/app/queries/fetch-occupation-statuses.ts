"use client";
import { useQuery } from "@tanstack/react-query";

export type OccupationStatusOption = {
  value: string;
  label: string;
  count: number;
};

export type OccupationStatusesResponse = {
  success: boolean;
  occupationStatuses: OccupationStatusOption[];
};

async function getOccupationStatuses(signal?: AbortSignal): Promise<OccupationStatusesResponse> {
  const url = "/api/alumni/occupation-statuses";
  const res = await fetch(url, { 
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

export function useOccupationStatuses() {
  return useQuery<OccupationStatusesResponse, Error>({
    queryKey: ["occupation-statuses"],
    queryFn: ({ signal }) => getOccupationStatuses(signal),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}

