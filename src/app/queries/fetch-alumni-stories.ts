"use client";
import { useQuery } from "@tanstack/react-query";

export type AlumniStoryItem = {
  id: string;
  date: string;
  name: string;
  program: string;
  session: string;
  shortDescription: string;
  imageUrl: string;
};

export const alumniStoriesKey = ["alumni", "stories", "list"] as const;

export async function getAlumniStories(signal?: AbortSignal): Promise<AlumniStoryItem[]> {
  const res = await fetch("/api/alumni-stories", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch alumni stories");
  }
  const data = (await res.json()) as { items: AlumniStoryItem[] };
  return data.items ?? [];
}

export function useAlumniStories() {
  return useQuery<AlumniStoryItem[], Error>({
    queryKey: alumniStoriesKey,
    queryFn: ({ signal }) => getAlumniStories(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    refetchOnMount: false,
  });
}