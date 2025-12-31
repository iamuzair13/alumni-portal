"use client";
import { useQuery } from "@tanstack/react-query";
import type { AlumniFilterOption } from "./fetch-alumni-faculties";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type AlumniChaptersResponse = {
  success: boolean;
  chapters: AlumniFilterOption[];
};

async function getAlumniNationalChapters(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<AlumniChaptersResponse> {
  const url = new URL("/api/alumni/chapters/national-chapters", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  console.log("[fetch-alumni-chapters] Fetching national chapters:", url.toString());
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-alumni-chapters] Error fetching national chapters:", err);
    throw new Error(err || "Failed to fetch national chapters");
  }
  const data = await res.json() as AlumniChaptersResponse;
  console.log("[fetch-alumni-chapters] National chapters response:", { 
    success: data.success, 
    chaptersCount: data.chapters?.length || 0,
    sample: data.chapters?.slice(0, 3)
  });
  return data;
}

async function getAlumniInternationalChapters(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<AlumniChaptersResponse> {
  const url = new URL("/api/alumni/chapters/international-chapters", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  console.log("[fetch-alumni-chapters] Fetching international chapters:", url.toString());
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-alumni-chapters] Error fetching international chapters:", err);
    throw new Error(err || "Failed to fetch international chapters");
  }
  const data = await res.json() as AlumniChaptersResponse;
  console.log("[fetch-alumni-chapters] International chapters response:", { 
    success: data.success, 
    chaptersCount: data.chapters?.length || 0,
    sample: data.chapters?.slice(0, 3)
  });
  return data;
}

export function useAlumniNationalChapters(filters?: MasterFilters) {
  return useQuery<AlumniChaptersResponse, Error>({
    queryKey: ["alumni", "chapters", "national", filters],
    queryFn: ({ signal }) => getAlumniNationalChapters(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useAlumniInternationalChapters(filters?: MasterFilters) {
  return useQuery<AlumniChaptersResponse, Error>({
    queryKey: ["alumni", "chapters", "international", filters],
    queryFn: ({ signal }) => getAlumniInternationalChapters(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

