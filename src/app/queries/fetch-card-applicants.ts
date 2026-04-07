"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type CardApplicant = {
  alumniid: number;
  sapid: string;
  registrationno: string | null;
  alumniname: string;
  email: string | null;
  yearofending: number | null;
  facultyname: string | null;
  departmentname: string | null;
  degreetitle: string | null;
  cardaddress: string | null;
  delivery_city: string | null;
  delivery_street_no: string | null;
  delivery_house_no: string | null;
  status: string | null;
  createdat: string | null;
};

export type CardStatusFilter = "all" | "under-review" | "underprinting" | "active" | "onhold" | "delivered" | "overdue";
export type OverdueType = "under-review" | "under-printing";

export type CardApplicantsResponse = {
  items: CardApplicant[];
  counts: {
    all: number;
    "under-review": number;
    underprinting: number;
    active: number;
    onhold: number;
    delivered: number;
    "overdue-under-review": number;
    "overdue-under-printing": number;
  };
};

export const cardApplicantsKey = (status?: CardStatusFilter, overdueType?: OverdueType) => {
  if (status === "overdue" && overdueType) {
    return ["alumni", "card", "applicants", status, overdueType] as const;
  }
  return ["alumni", "card", "applicants", status ?? "all"] as const;
};

export function useCardApplicants(status: CardStatusFilter = "all", options?: { enabled?: boolean; overdueType?: OverdueType }) {
  const overdueType = status === "overdue" ? options?.overdueType : undefined;
  return useQuery<CardApplicantsResponse>({
    queryKey: cardApplicantsKey(status, overdueType),
    queryFn: async () => {
      const url = new URL("/api/alumni-cards/applicants", window.location.origin);
      if (status && status !== "all") {
        if (status === "overdue") {
          url.searchParams.set("status", "overdue");
          if (options?.overdueType) {
            url.searchParams.set("overdueType", options.overdueType);
          }
        } else {
          url.searchParams.set("status", status);
        }
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      const j = await res.json();
      return {
        items: (j?.items ?? []) as CardApplicant[],
        counts: j?.counts ?? { 
          all: 0, 
          "under-review": 0, 
          underprinting: 0, 
          active: 0, 
          onhold: 0, 
          delivered: 0,
          "overdue-under-review": 0,
          "overdue-under-printing": 0,
        },
      } as CardApplicantsResponse;
    },
    enabled: options?.enabled !== false,
    staleTime: 60 * 1000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

// Hook to get counts only (for tabs)
export function useCardCounts() {
  return useQuery<CardApplicantsResponse["counts"]>({
    queryKey: ["alumni", "card", "counts"],
    queryFn: async () => {
      const res = await fetch(`/api/alumni-cards/counts`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${res.status})`);
      }
      const j = await res.json();
      return j ?? { 
        all: 0, 
        "under-review": 0, 
        underprinting: 0, 
        active: 0, 
        onhold: 0, 
        delivered: 0,
        "overdue-under-review": 0,
        "overdue-under-printing": 0,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useUpdateApplicantStatus() {
  const qc = useQueryClient();
  // Database values: "UnderReview", "UnderPrinting", "Active", "Onhold", "Delivered"
  return useMutation<unknown, Error, { sapId: string; status: "UnderReview" | "UnderPrinting" | "Active" | "Onhold" | "Delivered"; reason_onhold?: string }, { prev?: CardApplicant[] }>({
    mutationFn: async ({ sapId, status, reason_onhold }) => {
      const body: { status: string; reason_onhold?: string } = { status };
      if (status === "Onhold" && reason_onhold) {
        body.reason_onhold = reason_onhold;
      }
      const res = await fetch(`/api/alumni-cards/by-sap/${encodeURIComponent(sapId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      const statuses: CardStatusFilter[] = ["all", "under-review", "underprinting", "active", "onhold", "delivered", "overdue"];
      const overdueTypes: OverdueType[] = ["under-review", "under-printing"];
      const prevData: Record<string, CardApplicantsResponse | undefined> = {};
      
      for (const s of statuses) {
        const key = cardApplicantsKey(s);
        const prev = qc.getQueryData<CardApplicantsResponse>(key);
        prevData[s] = prev;
        
        if (prev) {
          // Find the item to update
          const itemIndex = prev.items.findIndex((r) => String(r.sapid) === String(sapId));
          if (itemIndex !== -1) {
            // Update the item's status
            const updatedItem = { ...prev.items[itemIndex], status };
            // Move the updated item to the first position
            const reorderedItems = [
              updatedItem,
              ...prev.items.slice(0, itemIndex),
              ...prev.items.slice(itemIndex + 1)
            ];
            const next = {
              ...prev,
              items: reorderedItems,
            };
            qc.setQueryData(key, next);
          } else {
            // If item not found, just update status normally
            const next = {
              ...prev,
              items: prev.items.map((r) => 
                String(r.sapid) === String(sapId) ? { ...r, status } : r
              ),
            };
            qc.setQueryData(key, next);
          }
        }
      }
      
      // Also handle overdue queries in onMutate
      for (const ot of overdueTypes) {
        const key = cardApplicantsKey("overdue", ot);
        const prev = qc.getQueryData<CardApplicantsResponse>(key);
        prevData[`overdue-${ot}`] = prev;
        
        if (prev) {
          const itemIndex = prev.items.findIndex((r) => String(r.sapid) === String(sapId));
          if (itemIndex !== -1) {
            const updatedItem = { ...prev.items[itemIndex], status };
            const reorderedItems = [
              updatedItem,
              ...prev.items.slice(0, itemIndex),
              ...prev.items.slice(itemIndex + 1)
            ];
            qc.setQueryData(key, {
              ...prev,
              items: reorderedItems,
            });
          }
        }
      }
      
      return { prev: prevData["all"]?.items };
    },
    onSuccess: (_data, { sapId }) => {
      // After successful update, ensure the updated item is first in all relevant queries
      const statuses: CardStatusFilter[] = ["all", "under-review", "underprinting", "active", "onhold", "delivered"];
      const overdueTypes: OverdueType[] = ["under-review", "under-printing"];
      
      for (const s of statuses) {
        const key = cardApplicantsKey(s);
        const current = qc.getQueryData<CardApplicantsResponse>(key);
        
        if (current) {
          const itemIndex = current.items.findIndex((r) => String(r.sapid) === String(sapId));
          if (itemIndex !== -1 && itemIndex !== 0) {
            // Move the updated item to the first position
            const updatedItem = current.items[itemIndex];
            const reorderedItems = [
              updatedItem,
              ...current.items.slice(0, itemIndex),
              ...current.items.slice(itemIndex + 1)
            ];
            qc.setQueryData(key, {
              ...current,
              items: reorderedItems,
            });
          }
        }
      }
      
      // Also update overdue queries
      for (const ot of overdueTypes) {
        const key = cardApplicantsKey("overdue", ot);
        const current = qc.getQueryData<CardApplicantsResponse>(key);
        
        if (current) {
          const itemIndex = current.items.findIndex((r) => String(r.sapid) === String(sapId));
          if (itemIndex !== -1 && itemIndex !== 0) {
            const updatedItem = current.items[itemIndex];
            const reorderedItems = [
              updatedItem,
              ...current.items.slice(0, itemIndex),
              ...current.items.slice(itemIndex + 1)
            ];
            qc.setQueryData(key, {
              ...current,
              items: reorderedItems,
            });
          }
        }
      }
    },
    onError: (_err, _vars, ctx) => {
      // Restore previous data on error
      if (ctx?.prev) {
        const key = cardApplicantsKey("all");
        qc.setQueryData(key, { items: ctx.prev, counts: { all: ctx.prev.length, "under-review": 0, underprinting: 0, active: 0, onhold: 0, delivered: 0 } });
      }
    },
    onSettled: () => {
      // Invalidate all card applicant queries and counts to refetch fresh data
      qc.invalidateQueries({ queryKey: ["alumni", "card", "applicants"] });
      qc.invalidateQueries({ queryKey: ["alumni", "card", "counts"] });
    },
  });
}