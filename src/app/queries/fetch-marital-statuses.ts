"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type MaritalStatusOption = {
  value: string;
  label: string;
  count: number;
};

export type MaritalStatusesResponse = {
  success: boolean;
  maritalStatuses: MaritalStatusOption[];
};

async function getMaritalStatuses(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<MaritalStatusesResponse> {
  const url = new URL("/api/alumni/marital-statuses", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();

    throw new Error(err || "Failed to fetch marital statuses");
  }
  
  const data = (await res.json()) as MaritalStatusesResponse;

  return data;
}

export function useMaritalStatuses(filters?: MasterFilters) {
  return useQuery<MaritalStatusesResponse, Error>({
    queryKey: ["marital-statuses", filters],
    queryFn: ({ signal }) => getMaritalStatuses(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });
}

