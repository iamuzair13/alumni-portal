"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type HomeCityOption = {
  value: string;
  label: string;
  count: number;
};

export type HomeCitiesResponse = {
  success: boolean;
  homeCities: HomeCityOption[];
};

async function getHomeCities(signal?: AbortSignal, filters?: MasterFilters): Promise<HomeCitiesResponse> {
  const url = new URL("/api/alumni/home-cities", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch home cities");
  }
  
  const data = (await res.json()) as HomeCitiesResponse;
  return data;
}

export function useHomeCities(filters?: MasterFilters) {
  return useQuery<HomeCitiesResponse, Error>({
    queryKey: ["home-cities", filters],
    queryFn: ({ signal }) => getHomeCities(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

