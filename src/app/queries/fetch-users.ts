"use client";
import { useQuery } from "@tanstack/react-query";

export type AdminUser = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
};

export async function getUsersList(signal?: AbortSignal): Promise<AdminUser[]> {
  const res = await fetch("/api/users", { signal, headers: { accept: "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch users");
  }
  const data = (await res.json()) as { items: AdminUser[] };
  return data.items ?? [];
}

export function useUsersList() {
  return useQuery({
    queryKey: ["users", "list"],
    queryFn: ({ signal }) => getUsersList(signal),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });
}