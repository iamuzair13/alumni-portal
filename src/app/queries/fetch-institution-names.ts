"use client";
import { useQuery } from "@tanstack/react-query";

export type InstitutionNameOption = {
  value: string;
  label: string;
  count: number;
};

export type InstitutionNamesResponse = {
  success: boolean;
  institutionNames: InstitutionNameOption[];
};

async function getInstitutionNames(signal?: AbortSignal): Promise<InstitutionNamesResponse> {
  const url = "/api/alumni/institution-names";
  const res = await fetch(url, { 
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

export function useInstitutionNames() {
  return useQuery<InstitutionNamesResponse, Error>({
    queryKey: ["institution-names"],
    queryFn: ({ signal }) => getInstitutionNames(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

