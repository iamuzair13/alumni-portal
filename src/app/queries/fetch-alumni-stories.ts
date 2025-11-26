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
  try {
    const res = await fetch("/api/alumni-stories", { signal, headers: { accept: "application/json" } });
    if (!res.ok) {
      // Try to parse error message from JSON
      let errorMessage = "Failed to fetch alumni stories";
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If JSON parsing fails, try text
        try {
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
        } catch {
          // Use default message
        }
      }
      throw new Error(errorMessage);
    }
    const data = (await res.json()) as { items: AlumniStoryItem[] };
    return data.items ?? [];
  } catch (err) {
    // If it's an abort error, re-throw it
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    // For other errors, log and re-throw with a user-friendly message
    console.error("[Alumni Stories] Error fetching stories:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to load alumni stories. Please try again later.");
  }
}

export function useAlumniStories() {
  return useQuery<AlumniStoryItem[], Error>({
    queryKey: alumniStoriesKey,
    queryFn: ({ signal }) => getAlumniStories(signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true, // Only refetch if data is stale
  });
}