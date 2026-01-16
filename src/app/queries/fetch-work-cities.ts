"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type WorkCityOption = {
  value: string;
  label: string;
  count: number;
};

export type WorkCitiesResponse = {
  success: boolean;
  workCities: WorkCityOption[];
};

async function getWorkCities(signal?: AbortSignal, filters?: MasterFilters): Promise<WorkCitiesResponse> {
  const url = new URL("/api/alumni/work-cities", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch work cities");
  }
  
  const data = (await res.json()) as WorkCitiesResponse;
  return data;
}

export function useWorkCities(filters?: MasterFilters) {
  return useQuery<WorkCitiesResponse, Error>({
    queryKey: ["work-cities", filters],
    queryFn: ({ signal }) => getWorkCities(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

