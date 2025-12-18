"use client";
import { useQuery } from "@tanstack/react-query";

export type WorkCountryOption = {
  value: string;
  label: string;
  count: number;
};

export type WorkCountriesResponse = {
  success: boolean;
  workCountries: WorkCountryOption[];
};

async function getWorkCountries(signal?: AbortSignal): Promise<WorkCountriesResponse> {
  const url = "/api/alumni/work-countries";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-work-countries] API error:", res.status, err);
    throw new Error(err || "Failed to fetch work countries");
  }
  
  const data = (await res.json()) as WorkCountriesResponse;
  return data;
}

export function useWorkCountries() {
  return useQuery<WorkCountriesResponse, Error>({
    queryKey: ["work-countries"],
    queryFn: ({ signal }) => getWorkCountries(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

