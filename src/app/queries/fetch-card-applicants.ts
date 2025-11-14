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

export const cardApplicantsKey = ["alumni", "card", "applicants"] as const;

export function useCardApplicants() {
  return useQuery<CardApplicant[]>({
    queryKey: cardApplicantsKey,
    queryFn: async () => {
      const res = await fetch(`/api/alumni-cards/applicants`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      const j = await res.json();
      return (j?.items ?? []) as CardApplicant[];
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useUpdateApplicantStatus() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { sapId: string; status: "pending" | "rejected" | "delivered" }, { prev?: CardApplicant[] }>({
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
      await qc.cancelQueries({ queryKey: cardApplicantsKey });
      const prev = qc.getQueryData<CardApplicant[]>(cardApplicantsKey) ?? undefined;
      if (prev) {
        const next = prev.map((r) => (String(r.sapid) === String(sapId) ? { ...r, status } : r));
        qc.setQueryData(cardApplicantsKey, next);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(cardApplicantsKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cardApplicantsKey, exact: true });
    },
  });
}