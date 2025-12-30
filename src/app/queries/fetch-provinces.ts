"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type ProvinceOption = {
  value: string;
  label: string;
  count: number;
};

export type ProvincesResponse = {
  success: boolean;
  provinces: ProvinceOption[];
};

async function getProvinces(signal?: AbortSignal, filters?: MasterFilters): Promise<ProvincesResponse> {
  const url = new URL("/api/alumni/provinces", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-provinces] API error:", res.status, err);
    throw new Error(err || "Failed to fetch provinces");
  }
  
  const data = (await res.json()) as ProvincesResponse;
  return data;
}

export function useProvinces(filters?: MasterFilters) {
  return useQuery<ProvincesResponse, Error>({
    queryKey: ["provinces", filters],
    queryFn: ({ signal }) => getProvinces(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

