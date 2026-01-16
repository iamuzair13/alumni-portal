"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type WorkCountryOption = {
  value: string;
  label: string;
  count: number;
};

export type WorkCountriesResponse = {
  success: boolean;
  workCountries: WorkCountryOption[];
};

async function getWorkCountries(signal?: AbortSignal, filters?: MasterFilters): Promise<WorkCountriesResponse> {
  const url = new URL("/api/alumni/work-countries", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch work countries");
  }
  
  const data = (await res.json()) as WorkCountriesResponse;
  return data;
}

export function useWorkCountries(filters?: MasterFilters) {
  return useQuery<WorkCountriesResponse, Error>({
    queryKey: ["work-countries", filters],
    queryFn: ({ signal }) => getWorkCountries(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

