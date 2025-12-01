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
  lasttimelogin?: string | null;
  logincount?: number | null;
};

export type AlumniListResponse = {
  items: AlumniListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getAlumniList(
  signal?: AbortSignal,
  search?: string,
  page: number = 1,
  limit: number = 100,
  status?: string // Filter by verify status: "verified", "unverified", "underApproval"
): Promise<AlumniListResponse> {
  const url = new URL("/api/alumni", typeof window !== "undefined" ? window.location.origin : "");
  if (search) {
    url.searchParams.set("search", search);
  }
  if (status) {
    url.searchParams.set("status", status);
  }
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  
  const res = await fetch(url.toString(), { signal, headers: { "accept": "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch alumni list");
  }
  const data = (await res.json()) as AlumniListResponse;
  return data;
}

export function useAlumniListPaginated(search?: string, page: number = 1, pageSize: number = 100, status?: string) {
  return useQuery<AlumniListResponse, Error>({
    queryKey: ["alumnilist", search, page, pageSize, status],
    queryFn: ({ signal }) => {
      console.log("[useAlumniListPaginated] Fetching with status:", status);
      return getAlumniList(signal, search, page, pageSize, status);
    },
    staleTime: 0, // Always consider data stale - refetch on mount/tab change
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnReconnect: true,
    refetchOnMount: true, // Always refetch when component mounts
  });
}

export type AlumniCounts = {
  total: number;
  verified: number;
  unverified: number;
  underApproval: number;
  active: number;
  inactive: number;
  category: {
    aPlus: number;
    a: number;
    b: number;
    c: number;
  };
};

export async function getAlumniCounts(signal?: AbortSignal, search?: string): Promise<AlumniCounts> {
  const url = new URL("/api/alumni/counts", typeof window !== "undefined" ? window.location.origin : "");
  if (search) {
    url.searchParams.set("search", search);
  }
  
  const res = await fetch(url.toString(), { signal, headers: { "accept": "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch alumni counts");
  }
  const data = (await res.json()) as AlumniCounts;
  return data;
}

