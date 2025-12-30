"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type CardStatus = "pending" | "rejected" | "delivered";

export type CardData = {
  cardid: number;
  alumniid: number;
  cnicno: string | null;
  cardaddress: string | null;
  status: string | null; // Database values: "Pending", "Process", "Active", "Delivered", "Onhold"
  cardpicture: string | null;
  card_image: string | null;
  createdat: string | null;
  reason_onhold: string | null;
  validity_date?: string | null;
};

export const cardStatusKey = (sapId: string | undefined) => ["alumni", "card", sapId ?? ""];

export function useCardStatus(sapId: string | undefined) {
  return useQuery<CardData | null>({
    queryKey: cardStatusKey(sapId),
    enabled: !!sapId,
    queryFn: async () => {
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(String(sapId))}`, { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      const j = await res.json();
      return (j?.card ?? null) as CardData | null;
    },
    staleTime: 5 * 60_000, // 5 minutes - reduce refetching
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchOnMount: false, // Don't refetch on mount if data exists
  });
}

export function useUpdateCardStatus(sapId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: CardStatus) => {
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(String(sapId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cardStatusKey(sapId), exact: true });
      // Invalidate all card applicant queries (all statuses)
      qc.invalidateQueries({ queryKey: ["alumni", "card", "applicants"] });
    },
  });
}