"use client";
import { useQuery } from "@tanstack/react-query";

export type CampusOption = {
  value: string;
  label: string;
  count: number;
};

export type CampusesResponse = {
  success: boolean;
  campuses: CampusOption[];
};

async function getCampuses(signal?: AbortSignal): Promise<CampusesResponse> {
  const url = "/api/alumni/campuses";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-campuses] API error:", res.status, err);
    throw new Error(err || "Failed to fetch campuses");
  }
  
  const data = (await res.json()) as CampusesResponse;
  console.log("[fetch-campuses] Received data:", data);
  return data;
}

export function useCampuses() {
  return useQuery<CampusesResponse, Error>({
    queryKey: ["campuses"],
    queryFn: ({ signal }) => getCampuses(signal),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}

