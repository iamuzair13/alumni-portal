"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type CategoryOption = {
  value: string;
  label: string;
  count: number;
};

export type CategoriesResponse = {
  success: boolean;
  categories: CategoryOption[];
};

async function getCategories(signal?: AbortSignal, filters?: MasterFilters): Promise<CategoriesResponse> {
  const url = new URL("/api/alumni/categories", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch categories");
  }
  
  const data = (await res.json()) as CategoriesResponse;
  return data;
}

export function useCategories(filters?: MasterFilters) {
  return useQuery<CategoriesResponse, Error>({
    queryKey: ["categories", filters],
    queryFn: ({ signal }) => getCategories(signal, filters),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}
