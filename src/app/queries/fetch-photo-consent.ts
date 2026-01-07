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
    console.error("[fetch-photo-consent] API error:", res.status, err);
    throw new Error(err || "Failed to fetch photo consent");
  }
  
  const data = (await res.json()) as PhotoConsentResponse;
  console.log("[fetch-photo-consent] Received data:", data);
  return data;
}

export function usePhotoConsent(filters?: MasterFilters) {
  return useQuery<PhotoConsentResponse, Error>({
    queryKey: ["photoConsent", filters],
    queryFn: ({ signal }) => getPhotoConsent(signal, filters),
    staleTime: 0, // Always consider data stale - refetch to get latest values
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus to get updated values
    refetchOnReconnect: true, // Refetch on reconnect
    refetchOnMount: true, // Always refetch when component mounts to get latest data
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });
}


