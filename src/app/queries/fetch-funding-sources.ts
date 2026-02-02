"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type FundingSourceOption = {
  value: string;
  label: string;
  count: number;
};

export type FundingSourcesResponse = {
  success: boolean;
  fundingSources: FundingSourceOption[];
};

async function getFundingSources(signal?: AbortSignal, filters?: MasterFilters): Promise<FundingSourcesResponse> {
  const url = new URL("/api/alumni/funding-sources", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch funding sources");
  }
  
  const data = (await res.json()) as FundingSourcesResponse;
  return data;
}

export function useFundingSources(filters?: MasterFilters) {
  return useQuery<FundingSourcesResponse, Error>({
    queryKey: ["funding-sources", filters],
    queryFn: ({ signal }) => getFundingSources(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}

