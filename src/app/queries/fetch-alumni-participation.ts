"use client";
import { useQuery } from "@tanstack/react-query";

export type MentorshipItem = {
  sapid: string;
  name: string;
  department: string | null;
  faculty: string | null;
  program: string | null;
  email: string | null;
  topics: string[];
  areas: string[];
  day: string;
  time: string;
};

export async function getAlumniParticipationList(signal?: AbortSignal): Promise<MentorshipItem[]> {
  const res = await fetch("/api/alumni/talks", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch participation list");
  }
  const data = (await res.json()) as { items: MentorshipItem[] };
  return data.items ?? [];
}

export function useAlumniParticipationList() {
  return useQuery({
    queryKey: ["alumni", "participation", "list"],
    queryFn: ({ signal }) => getAlumniParticipationList(signal),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });
}