"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type OccupationTransitionTimingOption = {
  value: string;
  label: string;
  count: number;
};

export type OccupationTransitionTimingsResponse = {
  success: boolean;
  occupationTransitionTimings: OccupationTransitionTimingOption[];
};

async function getOccupationTransitionTimings(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<OccupationTransitionTimingsResponse> {
  const url = new URL("/api/alumni/occupation-transition-timings", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);

  const res = await fetch(url.toString(), {
    signal,
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    const err = await res.text();

    throw new Error(err || "Failed to fetch occupation transition timings");
  }

  const data = (await res.json()) as OccupationTransitionTimingsResponse;

  return data;
}

export function useOccupationTransitionTimings(filters?: MasterFilters) {
  return useQuery<OccupationTransitionTimingsResponse, Error>({
    queryKey: ["occupation-transition-timings", filters],
    queryFn: ({ signal }) => getOccupationTransitionTimings(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}
