"use client";

import { useQuery } from "@tanstack/react-query";

export type EmailLogItem = {
  id: number;
  created_at: string;
  recipient_email: string;
  alumni_id: number | null;
  subject: string;
  body: string;
  status: string;
  error_message: string | null;
  triggered_by: string;
  action_type: string | null;
};

export const emailHistoryKey = (alumniId: number) => ["email-history", alumniId] as const;

export async function getEmailHistory(alumniId: number, signal?: AbortSignal): Promise<EmailLogItem[]> {
  const url = new URL("/api/email-history", typeof window !== "undefined" ? window.location.origin : "");
  url.searchParams.set("alumniId", String(alumniId));
  const res = await fetch(url.toString(), { signal, headers: { accept: "application/json" } });
  const data = (await res.json().catch(() => ({}))) as { items?: EmailLogItem[]; error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `Failed to fetch email history (${res.status})`);
  }
  return Array.isArray(data.items) ? data.items : [];
}

export function useEmailHistory(alumniId: number | null | undefined, enabled: boolean = true) {
  const numericId = alumniId === null || alumniId === undefined ? null : Number(alumniId);
  const canRun = enabled && numericId !== null && Number.isFinite(numericId) && numericId > 0;

  return useQuery<EmailLogItem[], Error>({
    queryKey: canRun ? emailHistoryKey(numericId as number) : ["email-history", "disabled"],
    queryFn: ({ signal }) => getEmailHistory(numericId as number, signal),
    enabled: canRun,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: [],
  });
}
