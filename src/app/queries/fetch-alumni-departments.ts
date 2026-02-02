"use client";
import { useQuery } from "@tanstack/react-query";
import type { AlumniFilterOption } from "./fetch-alumni-faculties";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type AlumniDepartmentsResponse = {
  success: boolean;
  departments: AlumniFilterOption[];
};

async function getAlumniDepartments(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<AlumniDepartmentsResponse> {
  const url = new URL("/api/alumni/departments", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch departments");
  }
  return (await res.json()) as AlumniDepartmentsResponse;
}

export function useAlumniDepartments(filters?: MasterFilters) {
  return useQuery<AlumniDepartmentsResponse, Error>({
    queryKey: ["alumni", "departments", filters],
    queryFn: ({ signal }) => getAlumniDepartments(signal, filters),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}


