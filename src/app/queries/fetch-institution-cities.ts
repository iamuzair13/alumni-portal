"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type InstitutionCityOption = {
  value: string;
  label: string;
  count: number;
};

export type InstitutionCitiesResponse = {
  success: boolean;
  institutionCities: InstitutionCityOption[];
};

async function getInstitutionCities(signal?: AbortSignal, filters?: MasterFilters): Promise<InstitutionCitiesResponse> {
  const url = new URL("/api/alumni/institution-cities", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch institution cities");
  }
  
  const data = (await res.json()) as InstitutionCitiesResponse;
  return data;
}

export function useInstitutionCities(filters?: MasterFilters) {
  return useQuery<InstitutionCitiesResponse, Error>({
    queryKey: ["institution-cities", filters],
    queryFn: ({ signal }) => getInstitutionCities(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}

