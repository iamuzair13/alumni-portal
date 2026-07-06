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
  status: string;
  rejectionReason?: string | null;
  alumniId?: number;
  email?: string | null;
};

export type AlumniStoriesResponse = {
  items: AlumniStoryItem[];
  counts?: {
    pending: number;
    approved: number;
    notApproved: number;
  };
};

export const alumniStoriesKey = ["alumni", "stories", "list"] as const;

export function alumniStoriesQueryKey(status?: string) {
  return status ? [...alumniStoriesKey, status] as const : alumniStoriesKey;
}

export async function getAlumniStories(
  signal?: AbortSignal,
  status?: string
): Promise<AlumniStoriesResponse> {
  try {
    const url = new URL("/api/alumni-stories", typeof window !== "undefined" ? window.location.origin : "");
    if (status && status !== "all") {
      url.searchParams.set("status", status);
    }

    const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
    const data = (await res.json().catch(() => ({ items: [] }))) as AlumniStoriesResponse & { error?: string };

    if (Array.isArray(data.items)) {
      return {
        items: data.items,
        counts: data.counts,
      };
    }

    if (res.ok) {
      return { items: [] };
    }

    return { items: [] };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    return { items: [] };
  }
}

export function useAlumniStories(status?: string) {
  return useQuery<AlumniStoriesResponse, Error>({
    queryKey: alumniStoriesQueryKey(status),
    queryFn: ({ signal }) => getAlumniStories(signal, status),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1000,
    placeholderData: { items: [] },
  });
}
