"use client";
import { useQuery } from "@tanstack/react-query";

export type AdmissionYearOption = {
  value: string;
  label: string;
  count: number;
};

export type AdmissionYearsResponse = {
  success: boolean;
  admissionYears: AdmissionYearOption[];
};

async function getAdmissionYears(signal?: AbortSignal): Promise<AdmissionYearsResponse> {
  const url = "/api/alumni/admission-years";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-admission-years] API error:", res.status, err);
    throw new Error(err || "Failed to fetch admission years");
  }
  
  const data = (await res.json()) as AdmissionYearsResponse;
  return data;
}

export function useAdmissionYears() {
  return useQuery<AdmissionYearsResponse, Error>({
    queryKey: ["admission-years"],
    queryFn: ({ signal }) => getAdmissionYears(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

