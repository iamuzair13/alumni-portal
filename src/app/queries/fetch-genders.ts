"use client";
import { useQuery } from "@tanstack/react-query";

export type GenderOption = {
  value: string;
  label: string;
  count: number;
};

export type GendersResponse = {
  success: boolean;
  genders: GenderOption[];
};

async function getGenders(signal?: AbortSignal): Promise<GendersResponse> {
  const url = "/api/alumni/genders";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-genders] API error:", res.status, err);
    throw new Error(err || "Failed to fetch genders");
  }
  
  const data = (await res.json()) as GendersResponse;
  console.log("[fetch-genders] Received data:", data);
  return data;
}

export function useGenders() {
  return useQuery<GendersResponse, Error>({
    queryKey: ["genders"],
    queryFn: ({ signal }) => getGenders(signal),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}

