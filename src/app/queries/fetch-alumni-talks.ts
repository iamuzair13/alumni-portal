"use client";

import { useQuery } from "@tanstack/react-query";

export type AlumniTalkItem = {
  id: number;
  created_at: string;
  updated_at: string;
  alumniid: number;
  topic: string | null;
  activity: string | null;
  mode: string | null;
  brief_outline: string | null;
  date_1: string | null;
  timings_1: string | null;
  date_2: string | null;
  timings_2: string | null;
  date_3: string | null;
  timings_3: string | null;
  status: string | null;
  confirmed_date: string | null;
  confirmed_timings: string | null;
  admin_proposed_date: string | null;
  admin_proposed_timings: string | null;
  admin_note: string | null;
  alumni_note: string | null;
};

export const alumniTalksKey = ["alumni", "talks", "list"] as const;

export async function getAlumniTalks(signal?: AbortSignal): Promise<AlumniTalkItem[]> {
  const res = await fetch("/api/alumni/talks", { signal, headers: { accept: "application/json" }, cache: "no-store" });
  const data = (await res.json().catch(() => ({ items: [] }))) as { items?: AlumniTalkItem[] };
  if (Array.isArray(data.items)) return data.items;
  if (res.ok) return [];
  return [];
}

export function useAlumniTalks() {
  return useQuery<AlumniTalkItem[], Error>({
    queryKey: alumniTalksKey,
    queryFn: ({ signal }) => getAlumniTalks(signal),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: [],
  });
}
