"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type PassingYearOption = {
  value: string;
  label: string;
  count: number;
};

export type PassingYearsResponse = {
  success: boolean;
  passingYears: PassingYearOption[];
};

async function getPassingYears(signal?: AbortSignal, filters?: MasterFilters): Promise<PassingYearsResponse> {
  const url = new URL("/api/alumni/passing-years", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch passing years");
  }
  
  const data = (await res.json()) as PassingYearsResponse;
  return data;
}

export function usePassingYears(filters?: MasterFilters) {
  return useQuery<PassingYearsResponse, Error>({
    queryKey: ["passing-years", filters],
    queryFn: ({ signal }) => getPassingYears(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

