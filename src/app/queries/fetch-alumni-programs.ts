"use client";
import { useQuery } from "@tanstack/react-query";
import type { AlumniFilterOption } from "./fetch-alumni-faculties";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type AlumniProgramsResponse = {
  success: boolean;
  programs: AlumniFilterOption[];
};

async function getAlumniPrograms(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<AlumniProgramsResponse> {
  const url = new URL("/api/alumni/programs", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch programs");
  }
  return (await res.json()) as AlumniProgramsResponse;
}

export function useAlumniPrograms(filters?: MasterFilters) {
  return useQuery<AlumniProgramsResponse, Error>({
    queryKey: ["alumni", "programs", filters],
    queryFn: ({ signal }) => getAlumniPrograms(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}


