"use client";
import { useQuery } from "@tanstack/react-query";

export type AlumniStoryItem = {
  id: string;
  date: string;
  title: string;
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
    
    // Parse response regardless of status code
    const data = await res.json().catch(() => ({ items: [] })) as { items?: AlumniStoryItem[]; error?: string };
    
    // If we have items, return them (even if empty - that's a valid state)
    if (Array.isArray(data.items)) {
      return data.items;
    }
    
    // If no items array but status is ok, return empty array (no stories is valid)
    if (res.ok) {
      return [];
    }
    
    // Only throw error if status is not ok AND we don't have items
    // But log a warning instead of throwing for better UX
    console.warn("[Alumni Stories] API returned error but we'll show empty state:", data.error);
    return []; // Return empty array so UI shows "no stories" message instead of error
  } catch (err) {
    // If it's an abort error, re-throw it (for React Query cancellation)
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    
    // For network errors or other issues, log but return empty array
    // This allows the UI to show "no stories" instead of a scary error
    console.warn("[Alumni Stories] Error fetching stories, showing empty state:", err);
    return []; // Return empty array so UI shows friendly "no stories" message
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
    retry: 2, // Retry failed requests 2 times
    retryDelay: 1000, // Wait 1 second between retries
    // Return empty array as default so UI doesn't break
    placeholderData: [],
  });
}