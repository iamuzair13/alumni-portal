"use client";
import { useQuery } from "@tanstack/react-query";

export type PassingYearOption = {
  value: string;
  label: string;
  count: number;
};

export type PassingYearsResponse = {
  success: boolean;
  passingYears: PassingYearOption[];
};

async function getPassingYears(signal?: AbortSignal): Promise<PassingYearsResponse> {
  const url = "/api/alumni/passing-years";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-passing-years] API error:", res.status, err);
    throw new Error(err || "Failed to fetch passing years");
  }
  
  const data = (await res.json()) as PassingYearsResponse;
  return data;
}

export function usePassingYears() {
  return useQuery<PassingYearsResponse, Error>({
    queryKey: ["passing-years"],
    queryFn: ({ signal }) => getPassingYears(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

