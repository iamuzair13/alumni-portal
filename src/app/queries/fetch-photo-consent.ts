"use client";
import { useQuery } from "@tanstack/react-query";
import type { MasterFilters } from "./master-filter-types";
import { addFilterParamsToUrl } from "./master-filter-types";

export type PhotoConsentOption = {
  value: string;
  label: string;
  count: number;
};

export type PhotoConsentResponse = {
  success: boolean;
  photoConsents: PhotoConsentOption[];
};

async function getPhotoConsent(
  signal?: AbortSignal,
  filters?: MasterFilters
): Promise<PhotoConsentResponse> {
  const url = new URL("/api/alumni/photo-consent", typeof window !== "undefined" ? window.location.origin : "");
  addFilterParamsToUrl(url, filters);
  
  const res = await fetch(url.toString(), { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch photo consent");
  }
  
  const data = (await res.json()) as PhotoConsentResponse;
  return data;
}

export function usePhotoConsent(filters?: MasterFilters) {
  return useQuery<PhotoConsentResponse, Error>({
    queryKey: ["photoConsent", filters],
    queryFn: ({ signal }) => getPhotoConsent(signal, filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}


