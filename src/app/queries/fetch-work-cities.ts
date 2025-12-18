"use client";
import { useQuery } from "@tanstack/react-query";

export type WorkCityOption = {
  value: string;
  label: string;
  count: number;
};

export type WorkCitiesResponse = {
  success: boolean;
  workCities: WorkCityOption[];
};

async function getWorkCities(signal?: AbortSignal): Promise<WorkCitiesResponse> {
  const url = "/api/alumni/work-cities";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-work-cities] API error:", res.status, err);
    throw new Error(err || "Failed to fetch work cities");
  }
  
  const data = (await res.json()) as WorkCitiesResponse;
  return data;
}

export function useWorkCities() {
  return useQuery<WorkCitiesResponse, Error>({
    queryKey: ["work-cities"],
    queryFn: ({ signal }) => getWorkCities(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

