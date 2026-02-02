"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type SectorOption = {
  value: string;
  label: string;
  count: number;
};

export type SectorsResponse = {
  success: boolean;
  sectors: SectorOption[];
};

async function getSectors(signal?: AbortSignal, filters?: MasterFilters): Promise<SectorsResponse> {
  const url = new URL("/api/alumni/sectors", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch sectors");
  }
  
  const data = (await res.json()) as SectorsResponse;
  return data;
}

export function useSectors(filters?: MasterFilters) {
  return useQuery<SectorsResponse, Error>({
    queryKey: ["sectors", filters],
    queryFn: ({ signal }) => getSectors(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}

