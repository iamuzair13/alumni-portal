"use client";
import { useQuery } from "@tanstack/react-query";

export type AlumniListItem = {
  alumniid: number;
  registrationno: string | null;
  sapid: string;
  alumniname: string;
  facultyname: string | null;
  campusname: string | null;
  departmentname: string | null;
  degreetitle: string | null;
  yearofending: number | null;
  country: string | null;
  city: string | null;
  verify?: string | null;
  employeed?: string | null;
  nameoforganization?: string | null;
  designation?: string | null;
  officialnumber?: string | null;
  officialemail?: string | null;
  personalemail?: string | null;
  contactno?: string | null;
};

export async function getAlumniList(signal?: AbortSignal): Promise<AlumniListItem[]> {
  const res = await fetch("/api/alumni", { signal, headers: { "accept": "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch alumni list");
  }
  const data = (await res.json()) as { items: AlumniListItem[] };
  return data.items ?? [];
}

export function useAlumniList() {
  return useQuery({
    queryKey: ["alumnilist"],
    queryFn: ({ signal }) => getAlumniList(signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });
}

