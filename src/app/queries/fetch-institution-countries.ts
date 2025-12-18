"use client";
import { useQuery } from "@tanstack/react-query";

export type InstitutionCountryOption = {
  value: string;
  label: string;
  count: number;
};

export type InstitutionCountriesResponse = {
  success: boolean;
  institutionCountries: InstitutionCountryOption[];
};

async function getInstitutionCountries(signal?: AbortSignal): Promise<InstitutionCountriesResponse> {
  const url = "/api/alumni/institution-countries";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-institution-countries] API error:", res.status, err);
    throw new Error(err || "Failed to fetch institution countries");
  }
  
  const data = (await res.json()) as InstitutionCountriesResponse;
  return data;
}

export function useInstitutionCountries() {
  return useQuery<InstitutionCountriesResponse, Error>({
    queryKey: ["institution-countries"],
    queryFn: ({ signal }) => getInstitutionCountries(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

