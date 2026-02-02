"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type AlumniFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AlumniFacultiesResponse = {
  success: boolean;
  faculties: AlumniFilterOption[];
};

async function getAlumniFaculties(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<AlumniFacultiesResponse> {
  const url = new URL("/api/alumni/faculties", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch faculties");
  }
  return (await res.json()) as AlumniFacultiesResponse;
}

export function useAlumniFaculties(filters?: Parameters<typeof getAlumniFaculties>[1]) {
  return useQuery<AlumniFacultiesResponse, Error>({
    queryKey: ["alumni", "faculties", filters],
    queryFn: ({ signal }) => getAlumniFaculties(signal, filters),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}


