"use client";

import { useQuery } from "@tanstack/react-query";

export type LeadershipApplicationTrace = {
  id: number;
  alumniId: number;
  sapId: string;
  registrationno?: string | null;
  name: string;
  email: string;
  faculty: string | null;
  department: string | null;
  program: string | null;
  type: "chapter" | "association";
  position: string;
  status: string;
  categoryType?: "national" | "international" | "association" | null;
  categoryName?: string | null;
  additionalAchievements?: string | null;
  cvFileUrl?: string | null;
  additionalFile1Url?: string | null;
  additionalFile2Url?: string | null;
  createdAt: string;
};

export type LeadershipApplicationsQueryInput = {
  type?: "all" | "chapter" | "association";
  status?: "all" | "pending" | "assessed" | "approved" | "rejected";
  role?: "all" | "president" | "vice_president" | "coordinator";
  search?: string;
  hasAdditionalAchievements?: boolean;
  alumniId?: number;
  nationalChapterId?: number;
  internationalChapterId?: number;
  associationId?: number;
};

export const leadershipApplicationsKey = (input: LeadershipApplicationsQueryInput) => [
  "leadership-applications",
  input.type ?? "all",
  input.status ?? "pending",
  input.role ?? "all",
  input.search ?? "",
  input.hasAdditionalAchievements ? "1" : "0",
  input.alumniId ?? 0,
];

export async function getLeadershipApplications(input: LeadershipApplicationsQueryInput): Promise<LeadershipApplicationTrace[]> {
  const params = new URLSearchParams();
  if (input.type && input.type !== "all") params.append("type", input.type);
  if (input.status && input.status !== "all") params.append("status", input.status);
  if (input.role && input.role !== "all") params.append("role", input.role);
  if (input.search) params.append("search", input.search);
  if (input.hasAdditionalAchievements) params.append("hasAdditionalAchievements", "1");
  if (input.alumniId && Number.isFinite(input.alumniId) && input.alumniId > 0) params.append("alumniId", String(input.alumniId));
  if (input.nationalChapterId && Number.isFinite(input.nationalChapterId) && input.nationalChapterId > 0) {
    params.append("nationalChapterId", String(input.nationalChapterId));
  }
  if (input.internationalChapterId && Number.isFinite(input.internationalChapterId) && input.internationalChapterId > 0) {
    params.append("internationalChapterId", String(input.internationalChapterId));
  }
  if (input.associationId && Number.isFinite(input.associationId) && input.associationId > 0) {
    params.append("associationId", String(input.associationId));
  }

  const res = await fetch(`/api/leadership/applications?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Failed to fetch applications");
  return ((data as any)?.items || []) as LeadershipApplicationTrace[];
}

export function useLeadershipApplications(input: LeadershipApplicationsQueryInput, enabled: boolean = true) {
  return useQuery({
    queryKey: leadershipApplicationsKey(input),
    queryFn: () => getLeadershipApplications(input),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}
