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
  // ID-based fields for faculty, department, program
  faculty: number | null;
  department: number | null;
  program: number | null;
  industry: string | null;
  employeed: string | null;
  occupation_transition_timing: string | null;
  nameoforganization: string | null;
  designation: string | null;
  totalyearsofexpereince: string | null;
  startOfCareer: number | null; // Year when career started
  officialemail: string | null;
  officialnumber: string | null;
  work_city: string | null;
  work_country: string | null;
  organization_address: string | null;
  image1: string | null;
  image2: string | null;
  cv: string | null;
  aboutme: string | null;
  about: string | null;
  lasttimelogin: string | null;
  logincount: number | null;
  verify: string | null;
  emailsendcount: number | null;
  emailsendstatus: string | null;
  createddatetime: string | null;
  updated_at: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
  password: string | null;
  father_cnic: string | null;
  category: string | null;
  // Higher Education fields
  degree_title: string | null;
  higher_education_institute_name: string | null;
  higher_education_program: string | null;
  higher_education_institute_country: string | null;
  higher_education_institute_city: string | null;
  is_scholarship: string | null;
  // Chapter and Association fields
  chapter: string | null;
  chapter1_id: number | null;
  chapter2_id: number | null;
  chapter3_id: number | null;
  association: string | null;
  association_id: number | null;
  alumni_consent_info: boolean | null;
  alumni_consent_pic: boolean | null;
  change_approval: string | null;
  pre_sap_registration: boolean | null;
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
    staleTime: 1 * 60 * 1000, // 1 minute - profile data can change, but not constantly
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true, // Refetch if data is stale
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
    staleTime: 1 * 60 * 1000, // 1 minute - profile data can change, but not constantly
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true, // Refetch if data is stale
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
export async function updateAlumniFields(
  sapId: string,
  fields: Partial<AlumniFullDetails>
): Promise<{ ok: boolean; updated: { alumniid: number; sapid: string }; message?: string; change_approval?: string | null }> {
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
  return data as { ok: boolean; updated: { alumniid: number; sapid: string }; message?: string; change_approval?: string | null };
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
      // Invalidate filter queries when profile is updated
      qc.invalidateQueries({ queryKey: ["marital-statuses"] });
      qc.invalidateQueries({ queryKey: ["genders"] });
      qc.invalidateQueries({ queryKey: ["campuses"] });
      qc.invalidateQueries({ queryKey: ["occupation-statuses"] });
      qc.invalidateQueries({ queryKey: ["occupation-transition-timings"] });
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
    staleTime: 2 * 60 * 1000, // 2 minutes - images don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });
}