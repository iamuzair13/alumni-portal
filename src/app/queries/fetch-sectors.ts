"use client";
import { useQuery } from "@tanstack/react-query";

export type SectorOption = {
  value: string;
  label: string;
  count: number;
};

export type SectorsResponse = {
  success: boolean;
  sectors: SectorOption[];
};

async function getSectors(signal?: AbortSignal): Promise<SectorsResponse> {
  const url = "/api/alumni/sectors";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-sectors] API error:", res.status, err);
    throw new Error(err || "Failed to fetch sectors");
  }
  
  const data = (await res.json()) as SectorsResponse;
  return data;
}

export function useSectors() {
  return useQuery<SectorsResponse, Error>({
    queryKey: ["sectors"],
    queryFn: ({ signal }) => getSectors(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

