"use client";
import { useQuery } from "@tanstack/react-query";

export type AssociationItem = {
  sapid: string;
  registrationNo: string | null;
  name: string;
  department: string | null;
  faculty: string | null;
  program: string | null;
  email: string | null;
  role: string | null;
  createdAt: string | Date | null;
};

export async function getAlumniAssociationList(signal?: AbortSignal): Promise<AssociationItem[]> {
  const res = await fetch("/api/alumni/association", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch association list");
  }
  const data = (await res.json()) as { items: AssociationItem[] };
  return data.items ?? [];
}

export function useAlumniAssociationList() {
  return useQuery({
    queryKey: ["alumni", "association", "list"],
    queryFn: ({ signal }) => getAlumniAssociationList(signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

