"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type GenderOption = {
  value: string;
  label: string;
  count: number;
};

export type GendersResponse = {
  success: boolean;
  genders: GenderOption[];
};

async function getGenders(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<GendersResponse> {
  const url = new URL("/api/alumni/genders", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();

    throw new Error(err || "Failed to fetch genders");
  }
  
  const data = (await res.json()) as GendersResponse;

  return data;
}

export function useGenders(filters?: MasterFilters) {
  return useQuery<GendersResponse, Error>({
    queryKey: ["genders", filters],
    queryFn: ({ signal }) => getGenders(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: false,
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}

