"use client";
import { useQuery } from "@tanstack/react-query";

export type AlumniFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type AlumniFacultiesResponse = {
  success: boolean;
  faculties: AlumniFilterOption[];
};

async function getAlumniFaculties(signal?: AbortSignal): Promise<AlumniFacultiesResponse> {
  const url = "/api/alumni/faculties";
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch faculties");
  }
  return (await res.json()) as AlumniFacultiesResponse;
}

export function useAlumniFaculties() {
  return useQuery<AlumniFacultiesResponse, Error>({
    queryKey: ["alumni", "faculties"],
    queryFn: ({ signal }) => getAlumniFaculties(signal),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
  });
}


