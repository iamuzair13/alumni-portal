"use client";
import { useQuery } from "@tanstack/react-query";
import type { AlumniFilterOption } from "./fetch-alumni-faculties";

export type AlumniDepartmentsResponse = {
  success: boolean;
  departments: AlumniFilterOption[];
};

async function getAlumniDepartments(signal?: AbortSignal): Promise<AlumniDepartmentsResponse> {
  const url = "/api/alumni/departments";
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch departments");
  }
  return (await res.json()) as AlumniDepartmentsResponse;
}

export function useAlumniDepartments() {
  return useQuery<AlumniDepartmentsResponse, Error>({
    queryKey: ["alumni", "departments"],
    queryFn: ({ signal }) => getAlumniDepartments(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}


