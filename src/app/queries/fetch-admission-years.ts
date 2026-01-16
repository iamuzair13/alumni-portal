"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type AdmissionYearOption = {
  value: string;
  label: string;
  count: number;
};

export type AdmissionYearsResponse = {
  success: boolean;
  admissionYears: AdmissionYearOption[];
};

async function getAdmissionYears(signal?: AbortSignal, filters?: MasterFilters): Promise<AdmissionYearsResponse> {
  const url = new URL("/api/alumni/admission-years", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch admission years");
  }
  
  const data = (await res.json()) as AdmissionYearsResponse;
  return data;
}

export function useAdmissionYears(filters?: MasterFilters) {
  return useQuery<AdmissionYearsResponse, Error>({
    queryKey: ["admission-years", filters],
    queryFn: ({ signal }) => getAdmissionYears(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

