"use client";
import { useQuery } from "@tanstack/react-query";

export type DegreeTitleOption = {
  value: string;
  label: string;
  count: number;
};

export type DegreeTitlesResponse = {
  success: boolean;
  degreeTitles: DegreeTitleOption[];
};

async function getDegreeTitles(signal?: AbortSignal): Promise<DegreeTitlesResponse> {
  const url = "/api/alumni/degree-titles";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-degree-titles] API error:", res.status, err);
    throw new Error(err || "Failed to fetch degree titles");
  }
  
  const data = (await res.json()) as DegreeTitlesResponse;
  return data;
}

export function useDegreeTitles() {
  return useQuery<DegreeTitlesResponse, Error>({
    queryKey: ["degree-titles"],
    queryFn: ({ signal }) => getDegreeTitles(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

