"use client";
import { useQuery } from "@tanstack/react-query";

export type InstitutionCityOption = {
  value: string;
  label: string;
  count: number;
};

export type InstitutionCitiesResponse = {
  success: boolean;
  institutionCities: InstitutionCityOption[];
};

async function getInstitutionCities(signal?: AbortSignal): Promise<InstitutionCitiesResponse> {
  const url = "/api/alumni/institution-cities";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-institution-cities] API error:", res.status, err);
    throw new Error(err || "Failed to fetch institution cities");
  }
  
  const data = (await res.json()) as InstitutionCitiesResponse;
  return data;
}

export function useInstitutionCities() {
  return useQuery<InstitutionCitiesResponse, Error>({
    queryKey: ["institution-cities"],
    queryFn: ({ signal }) => getInstitutionCities(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

