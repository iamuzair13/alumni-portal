"use client";
import { useQuery } from "@tanstack/react-query";

export type HomeCountryOption = {
  value: string;
  label: string;
  count: number;
};

export type HomeCountriesResponse = {
  success: boolean;
  homeCountries: HomeCountryOption[];
};

async function getHomeCountries(signal?: AbortSignal): Promise<HomeCountriesResponse> {
  const url = "/api/alumni/home-countries";
  const res = await fetch(url, { 
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

export function useHomeCountries() {
  return useQuery<HomeCountriesResponse, Error>({
    queryKey: ["home-countries"],
    queryFn: ({ signal }) => getHomeCountries(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

