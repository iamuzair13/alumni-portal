"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type CardApplicant = {
  alumniid: number;
  sapid: string;
  alumniname: string;
  email: string | null;
  yearofending: number | null;
  facultyname: string | null;
  departmentname: string | null;
  degreetitle: string | null;
  status: string | null;
  createdat: string | null;
};

export type CardStatusFilter = "all" | "active" | "pending" | "onhold" | "received";

export type CardApplicantsResponse = {
  items: CardApplicant[];
  counts: {
    all: number;
    active: number;
    pending: number;
    onhold: number;
    received: number;
  };
};

export const cardApplicantsKey = (status?: CardStatusFilter) => ["alumni", "card", "applicants", status ?? "all"] as const;

export function useCardApplicants(status: CardStatusFilter = "all", options?: { enabled?: boolean }) {
  return useQuery<CardApplicantsResponse>({
    queryKey: cardApplicantsKey(status),
    queryFn: async () => {
      const url = new URL("/api/alumni-cards/applicants", window.location.origin);
      if (status && status !== "all") {
        url.searchParams.set("status", status);
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      const j = await res.json();
      return {
        items: (j?.items ?? []) as CardApplicant[],
        counts: j?.counts ?? { all: 0, active: 0, pending: 0, onhold: 0, received: 0 },
      } as CardApplicantsResponse;
    },
    enabled: options?.enabled !== false,
    staleTime: 0, // Always fetch fresh data
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

// Hook to get counts only (for tabs)
export function useCardCounts() {
  return useQuery<CardApplicantsResponse["counts"]>({
    queryKey: cardApplicantsKey("all"),
    queryFn: async () => {
      const res = await fetch(`/api/alumni-cards/applicants?status=all`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      const j = await res.json();
      return j?.counts ?? { all: 0, active: 0, pending: 0, onhold: 0, received: 0 };
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function useUpdateApplicantStatus() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { sapId: string; status: "pending" | "rejected" | "delivered" | "received" }, { prev?: CardApplicant[] }>({
    mutationFn: async ({ sapId, status }) => {
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
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
    onMutate: async ({ sapId, status }) => {
      // Cancel all card applicant queries
      await qc.cancelQueries({ queryKey: ["alumni", "card", "applicants"] });
      
      // Update all status-specific queries
      const statuses: CardStatusFilter[] = ["all", "active", "pending", "onhold", "received"];
      const prevData: Record<string, CardApplicantsResponse | undefined> = {};
      
      for (const s of statuses) {
        const key = cardApplicantsKey(s);
        const prev = qc.getQueryData<CardApplicantsResponse>(key);
        prevData[s] = prev;
        
        if (prev) {
          const next = {
            ...prev,
            items: prev.items.map((r) => 
              String(r.sapid) === String(sapId) ? { ...r, status } : r
            ),
          };
          qc.setQueryData(key, next);
        }
      }
      
      return { prev: prevData["all"]?.items };
    },
    onError: (_err, _vars, ctx) => {
      // Restore previous data on error
      if (ctx?.prev) {
        const key = cardApplicantsKey("all");
        qc.setQueryData(key, { items: ctx.prev, counts: { all: ctx.prev.length, active: 0, pending: 0, onhold: 0, received: 0 } });
      }
    },
    onSettled: () => {
      // Invalidate all card applicant queries to refetch fresh data
      qc.invalidateQueries({ queryKey: ["alumni", "card", "applicants"] });
    },
  });
}