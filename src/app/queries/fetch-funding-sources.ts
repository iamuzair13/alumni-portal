"use client";
import { useQuery } from "@tanstack/react-query";

export type FundingSourceOption = {
  value: string;
  label: string;
  count: number;
};

export type FundingSourcesResponse = {
  success: boolean;
  fundingSources: FundingSourceOption[];
};

async function getFundingSources(signal?: AbortSignal): Promise<FundingSourcesResponse> {
  const url = "/api/alumni/funding-sources";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-funding-sources] API error:", res.status, err);
    throw new Error(err || "Failed to fetch funding sources");
  }
  
  const data = (await res.json()) as FundingSourcesResponse;
  return data;
}

export function useFundingSources() {
  return useQuery<FundingSourcesResponse, Error>({
    queryKey: ["funding-sources"],
    queryFn: ({ signal }) => getFundingSources(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

