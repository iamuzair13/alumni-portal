"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type DegreeTitleOption = {
  value: string;
  label: string;
  count: number;
};

export type DegreeTitlesResponse = {
  success: boolean;
  degreeTitles: DegreeTitleOption[];
};

async function getDegreeTitles(signal?: AbortSignal, filters?: MasterFilters): Promise<DegreeTitlesResponse> {
  const url = new URL("/api/alumni/degree-titles", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch degree titles");
  }
  
  const data = (await res.json()) as DegreeTitlesResponse;
  return data;
}

export function useDegreeTitles(filters?: MasterFilters) {
  return useQuery<DegreeTitlesResponse, Error>({
    queryKey: ["degree-titles", filters],
    queryFn: ({ signal }) => getDegreeTitles(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}

