"use client";
import { useQuery } from "@tanstack/react-query";
import type { AlumniFilterOption } from "./fetch-alumni-faculties";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type AlumniAssociationsResponse = {
  success: boolean;
  associations: AlumniFilterOption[];
};

async function getAlumniAssociations(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<AlumniAssociationsResponse> {
  const url = new URL("/api/alumni/association/associations", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch associations");
  }
  return (await res.json()) as AlumniAssociationsResponse;
}

export function useAlumniAssociations(filters?: MasterFilters) {
  return useQuery<AlumniAssociationsResponse, Error>({
    queryKey: ["alumni", "associations", filters],
    queryFn: ({ signal }) => getAlumniAssociations(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

