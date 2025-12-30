"use client";
import { useQuery } from "@tanstack/react-query";

export type ProgramEnrolledOption = {
  value: string;
  label: string;
  count: number;
};

export type ProgramsEnrolledResponse = {
  success: boolean;
  programsEnrolled: ProgramEnrolledOption[];
};

async function getProgramsEnrolled(signal?: AbortSignal): Promise<ProgramsEnrolledResponse> {
  const url = "/api/alumni/programs-enrolled";
  const res = await fetch(url, { 
    signal,
    headers: { "accept": "application/json" } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    console.error("[fetch-programs-enrolled] API error:", res.status, err);
    throw new Error(err || "Failed to fetch programs enrolled");
  }
  
  const data = (await res.json()) as ProgramsEnrolledResponse;
  return data;
}

export function useProgramsEnrolled() {
  return useQuery<ProgramsEnrolledResponse, Error>({
    queryKey: ["programs-enrolled"],
    queryFn: ({ signal }) => getProgramsEnrolled(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}

