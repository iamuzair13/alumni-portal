"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type HomeCountryOption = {
  value: string;
  label: string;
  count: number;
};

export type HomeCountriesResponse = {
  success: boolean;
  homeCountries: HomeCountryOption[];
};

async function getHomeCountries(signal?: AbortSignal, filters?: MasterFilters): Promise<HomeCountriesResponse> {
  const url = new URL("/api/alumni/home-countries", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-home-countries] API error:", res.status, err);
    throw new Error(err || "Failed to fetch home countries");
  }
  
  const data = (await res.json()) as HomeCountriesResponse;
  return data;
}

export function useHomeCountries(filters?: MasterFilters) {
  return useQuery<HomeCountriesResponse, Error>({
    queryKey: ["home-countries", filters],
    queryFn: ({ signal }) => getHomeCountries(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

