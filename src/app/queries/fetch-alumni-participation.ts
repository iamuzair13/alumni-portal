"use client";
import { useQuery } from "@tanstack/react-query";
import type { AlumniListItem } from "./fetch-alumni";

export async function getAlumniParticipationList(signal?: AbortSignal): Promise<AlumniListItem[]> {
  const res = await fetch("/api/alumni", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch participation list");
  }
  const data = (await res.json()) as { items: AlumniListItem[] };
  return data.items ?? [];
}

export function useAlumniParticipationList() {
  return useQuery({
    queryKey: ["alumni", "participation", "list"],
    queryFn: ({ signal }) => getAlumniParticipationList(signal),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}