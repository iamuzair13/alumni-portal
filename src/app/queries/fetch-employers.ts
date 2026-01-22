"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type EmployerOption = {
  value: string;
  label: string;
  count: number;
};

export type EmployersResponse = {
  success: boolean;
  employers: EmployerOption[];
};

async function getEmployers(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<EmployersResponse> {
  const url = new URL(
    "/api/alumni/employers",
    typeof window !== "undefined" ? window.location.origin : ""
  );
  addFilterParamsToUrl(url, filters);

  const res = await fetch(url.toString(), {
    signal,
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch employers");
  }

  const data = (await res.json()) as EmployersResponse;
  return data;
}

export function useEmployers(filters?: MasterFilters) {
  return useQuery<EmployersResponse, Error>({
    queryKey: ["employers", filters],
    queryFn: ({ signal }) => getEmployers(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}
