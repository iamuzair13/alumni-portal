"use client";
import { useQuery } from "@tanstack/react-query";

export type EventListItem = {
  id: string;
  title: string;
  venue: string;
  shortDescription: string;
  imageUrl?: string;
  category?: string;
  startTimeUTC?: string;
  endTimeUTC?: string;
};

export const eventsKey = ["events", "list"] as const;

export async function getEventsList(signal?: AbortSignal): Promise<EventListItem[]> {
  const res = await fetch("/api/events", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch events");
  }
  const data = (await res.json()) as { items: EventListItem[] };
  return data.items ?? [];
}

export function useEventsList() {
  return useQuery<EventListItem[], Error>({
    queryKey: eventsKey,
    queryFn: ({ signal }) => getEventsList(signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true, // Only refetch if data is stale
  });
}