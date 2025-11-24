"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAlumniBySapId, updateAlumniBySapId } from "@/services/alumniService";
import type { AlumniRegistrationComprehensiveForm } from "@/lib/alumniRegistration";

export const alumniProfileKey = (sapId: string | undefined) => ["alumni", "profile", sapId ?? ""];
export const alumniFullDetailsKey = (sapId: string | undefined) => ["alumni", "full-details", sapId ?? ""];
export const currentUserImageKey = () => ["alumni", "current-user-image"];

export type AlumniFullDetails = {
  alumniid: number | null;
  alumniemail: string | null;
  registrationno: string | null;
  sapid: string | null;
  alumniname: string | null;
  gender: string | null;
  fathername: string | null;
  dateofbirth: string | null;
  maritalstatus: string | null;
  cnicpassport: string | null;
  contactno: string | null;
  contactno1: string | null;
  contactno1show: boolean | null;
  personalemail: string | null;
  personalemailshow: boolean | null;
  universityemail: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  academicsession: string | null;
  degreetitle: string | null;
  cgpa: number | null;
  yearofstarting: number | null;
  yearofending: number | null;
  facultyname: string | null;
  campusname: string | null;
  departmentname: string | null;
  majorsubject: string | null;
  industry: string | null;
  employeed: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  officialemail: string | null;
  officialnumber: string | null;
  supervisorname: string | null;
  supervisordesignation: string | null;
  supervisoremail: string | null;
  supervisornumber: string | null;
  image1: string | null;
  cv: string | null;
  aboutme: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  verify: string | null;
  emailsendcount: number | null;
  emailsendstatus: string | null;
  createddatetime: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  password: string | null;
};

export async function getAlumniFullDetails(sapId: string): Promise<AlumniFullDetails> {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/full-details`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch alumni details");
  return data.item as AlumniFullDetails;
}

export function useAlumniFullDetails(sapId: string | undefined) {
  return useQuery({
    queryKey: alumniFullDetailsKey(sapId),
    queryFn: () => {
      if (!sapId) throw new Error("Missing sapid");
      return getAlumniFullDetails(sapId);
    },
    enabled: !!sapId,
    staleTime: 0, // Always consider data stale to ensure fresh data after updates
    gcTime: 0, // Don't cache data to always get fresh values
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true, // Refetch when component mounts
  });
}

export async function getAlumniProfile(sapId: string, ): Promise<AlumniRegistrationComprehensiveForm> {
  const res = await getAlumniBySapId(sapId);
  return res.item as AlumniRegistrationComprehensiveForm;
}

export function useAlumniProfile(sapId: string | undefined) {
  return useQuery({
    queryKey: alumniProfileKey(sapId),
    queryFn: () => {
      if (!sapId) throw new Error("Missing sapid");
      return getAlumniProfile(sapId );
    },
    enabled: !!sapId,
    staleTime: 0, // Always consider data stale to ensure fresh data after updates
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true, // Refetch when component mounts
  });
}

export function useUpdateAlumniProfile(sapId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AlumniRegistrationComprehensiveForm) => {
      if (!sapId) throw new Error("Missing sapid");
      return updateAlumniBySapId(sapId, payload);
    },
    onMutate: async (next) => {
      const key = alumniProfileKey(sapId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AlumniRegistrationComprehensiveForm>(key);
      qc.setQueryData<AlumniRegistrationComprehensiveForm>(key, (cur) => ({ ...(cur ?? next), ...next }));
      return { prev } as { prev?: AlumniRegistrationComprehensiveForm };
    },
    onError: (_err, _vars, ctx) => {
      const key = alumniProfileKey(sapId);
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: () => {
      const key = alumniProfileKey(sapId);
      const fullDetailsKey = alumniFullDetailsKey(sapId);
      // Invalidate both profile and full details queries on update
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: fullDetailsKey });
    },
  });
}

// Update specific fields in alumni profile
export async function updateAlumniFields(sapId: string, fields: Partial<AlumniFullDetails>): Promise<{ ok: boolean; updated: { alumniid: number; sapid: string } }> {
  const res = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/update-fields`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) {
    // Preserve the full error object with details
    const errorMessage = data?.error ? (typeof data.error === "string" ? data.error : JSON.stringify(data.error)) : "Failed to update profile";
    const error = new Error(JSON.stringify({ error: errorMessage, ...data }));
    throw error;
  }
  return data as { ok: boolean; updated: { alumniid: number; sapid: string } };
}

export function useUpdateAlumniFields(sapId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fields: Partial<AlumniFullDetails>) => {
      if (!sapId) throw new Error("Missing sapid");
      return updateAlumniFields(sapId, fields);
    },
    onSuccess: () => {
      const key = alumniFullDetailsKey(sapId);
      const profileKey = alumniProfileKey(sapId);
      // Invalidate both queries to refetch updated data
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: profileKey });
      // Also invalidate current user image query to update header
      qc.invalidateQueries({ queryKey: currentUserImageKey() });
    },
  });
}

// Fetch current user's profile image
export async function getCurrentUserImage(): Promise<{ image: string | null; timestamp: number }> {
  const res = await fetch("/api/alumni/current-user-image");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch current user image");
  return data as { image: string | null; timestamp: number };
}

export function useCurrentUserImage(enabled: boolean = true) {
  return useQuery({
    queryKey: currentUserImageKey(),
    queryFn: () => getCurrentUserImage(),
    enabled,
    staleTime: 0, // Always consider data stale to ensure fresh data after updates
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}