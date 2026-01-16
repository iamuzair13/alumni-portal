"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type InstitutionCountryOption = {
  value: string;
  label: string;
  count: number;
};

export type InstitutionCountriesResponse = {
  success: boolean;
  institutionCountries: InstitutionCountryOption[];
};

async function getInstitutionCountries(signal?: AbortSignal, filters?: MasterFilters): Promise<InstitutionCountriesResponse> {
  const url = new URL("/api/alumni/institution-countries", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch institution countries");
  }
  
  const data = (await res.json()) as InstitutionCountriesResponse;
  return data;
}

export function useInstitutionCountries(filters?: MasterFilters) {
  return useQuery<InstitutionCountriesResponse, Error>({
    queryKey: ["institution-countries", filters],
    queryFn: ({ signal }) => getInstitutionCountries(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

