"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type InstitutionNameOption = {
  value: string;
  label: string;
  count: number;
};

export type InstitutionNamesResponse = {
  success: boolean;
  institutionNames: InstitutionNameOption[];
};

async function getInstitutionNames(signal?: AbortSignal, filters?: MasterFilters): Promise<InstitutionNamesResponse> {
  const url = new URL("/api/alumni/institution-names", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-institution-names] API error:", res.status, err);
    throw new Error(err || "Failed to fetch institution names");
  }
  
  const data = (await res.json()) as InstitutionNamesResponse;
  return data;
}

export function useInstitutionNames(filters?: MasterFilters) {
  return useQuery<InstitutionNamesResponse, Error>({
    queryKey: ["institution-names", filters],
    queryFn: ({ signal }) => getInstitutionNames(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

