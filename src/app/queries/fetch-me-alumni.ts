"use client";
import { useQuery } from "@tanstack/react-query";

export type AlumniMe = {
  alumniid: number;
  name: string | null;
  faculty: string | null;
  degree: string | null;
  session: string | null;
};

export const alumniMeKey = ["alumni", "me"] as const;

export async function getAlumniMe(signal?: AbortSignal): Promise<AlumniMe> {
  const res = await fetch("/api/alumni/me", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch profile");
  }
  const data = (await res.json()) as { item: AlumniMe };
  return data.item;
}

export function useAlumniMe() {
  return useQuery<AlumniMe, Error>({
    queryKey: alumniMeKey,
    queryFn: ({ signal }) => getAlumniMe(signal),
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    refetchOnMount: false,
  });
}