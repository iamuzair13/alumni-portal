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
  category?: string | null;
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
  status?: string | string[], // Filter by verify status: "verified", "unverified", "underApproval" or array
  faculty?: string | string[], // Filter by faculty or array
  department?: string | string[], // Filter by department or array
  program?: string | string[], // Filter by program or array
  // Additional master filters
  gender?: string | string[],
  maritalStatus?: string | string[],
  homeCountry?: string | string[],
  homeCity?: string | string[],
  province?: string | string[],
  campus?: string | string[],
  admissionYear?: string | string[],
  passingYear?: string | string[],
  occupationStatus?: string | string[],
  sector?: string | string[],
  workCity?: string | string[],
  workCountry?: string | string[],
  institutionName?: string | string[],
  programEnrolled?: string | string[],
  fundingSource?: string | string[],
  institutionCountry?: string | string[],
  institutionCity?: string | string[],
  mrNo?: string | string[],
  photoConsent?: string | string[],
  sapIdState?: string | string[],
  regNoState?: string | string[]
): Promise<AlumniListResponse> {
  const url = new URL("/api/alumni", typeof window !== "undefined" ? window.location.origin : "");
  if (search) {
    url.searchParams.set("search", search);
  }
  if (status) {
    if (Array.isArray(status)) {
      status.forEach(s => url.searchParams.append("status", s));
    } else {
      url.searchParams.set("status", status);
    }
  }
  if (faculty) {
    if (Array.isArray(faculty)) {
      faculty.forEach(f => url.searchParams.append("faculty", f));
    } else {
      url.searchParams.set("faculty", faculty);
    }
  }
  if (department) {
    if (Array.isArray(department)) {
      department.forEach(d => url.searchParams.append("department", d));
    } else {
      url.searchParams.set("department", department);
    }
  }
  if (program) {
    if (Array.isArray(program)) {
      program.forEach(p => url.searchParams.append("program", p));
    } else {
      url.searchParams.set("program", program);
    }
  }
  
  // Add new filter parameters
  const addFilterParam = (key: string, value: string | string[] | undefined) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }
  };
  
  addFilterParam("gender", gender);
  addFilterParam("maritalStatus", maritalStatus);
  addFilterParam("homeCountry", homeCountry);
  addFilterParam("homeCity", homeCity);
  addFilterParam("province", province);
  addFilterParam("campus", campus);
  addFilterParam("admissionYear", admissionYear);
  addFilterParam("passingYear", passingYear);
  addFilterParam("occupationStatus", occupationStatus);
  addFilterParam("sector", sector);
  addFilterParam("workCity", workCity);
  addFilterParam("workCountry", workCountry);
  addFilterParam("institutionName", institutionName);
  addFilterParam("programEnrolled", programEnrolled);
  addFilterParam("fundingSource", fundingSource);
  addFilterParam("institutionCountry", institutionCountry);
  addFilterParam("institutionCity", institutionCity);
  addFilterParam("mrNo", mrNo);
  addFilterParam("photoConsent", photoConsent);
  addFilterParam("sapIdState", sapIdState);
  addFilterParam("regNoState", regNoState);
  
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

export function useAlumniListPaginated(
  search?: string, 
  page: number = 1, 
  pageSize: number = 100, 
  status?: string | string[],
  faculty?: string | string[],
  department?: string | string[],
  program?: string | string[],
  // Additional master filters
  gender?: string | string[],
  maritalStatus?: string | string[],
  homeCountry?: string | string[],
  homeCity?: string | string[],
  province?: string | string[],
  campus?: string | string[],
  admissionYear?: string | string[],
  passingYear?: string | string[],
  occupationStatus?: string | string[],
  sector?: string | string[],
  workCity?: string | string[],
  workCountry?: string | string[],
  institutionName?: string | string[],
  programEnrolled?: string | string[],
  fundingSource?: string | string[],
  institutionCountry?: string | string[],
  institutionCity?: string | string[],
  mrNo?: string | string[],
  photoConsent?: string | string[],
  sapIdState?: string | string[],
  regNoState?: string | string[]
) {
  return useQuery<AlumniListResponse, Error>({
    queryKey: ["alumnilist", search, page, pageSize, status, faculty, department, program, gender, maritalStatus, homeCountry, homeCity, province, campus, admissionYear, passingYear, occupationStatus, sector, workCity, workCountry, institutionName, programEnrolled, fundingSource, institutionCountry, institutionCity, mrNo, photoConsent, sapIdState, regNoState],
    queryFn: ({ signal }) => {
      console.log("[useAlumniListPaginated] Fetching with filters:", { status, faculty, department, program, gender, maritalStatus, homeCountry, homeCity, province, campus, admissionYear, passingYear, occupationStatus, sector, workCity, workCountry, institutionName, programEnrolled, fundingSource, institutionCountry, institutionCity, mrNo, photoConsent, sapIdState, regNoState });
      return getAlumniList(signal, search, page, pageSize, status, faculty, department, program, gender, maritalStatus, homeCountry, homeCity, province, campus, admissionYear, passingYear, occupationStatus, sector, workCity, workCountry, institutionName, programEnrolled, fundingSource, institutionCountry, institutionCity, mrNo, photoConsent, sapIdState, regNoState);
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
    d: number;
  };
};

export async function getAlumniCounts(
  signal?: AbortSignal, 
  search?: string,
  faculty?: string | string[],
  department?: string | string[],
  program?: string | string[],
  // Additional master filters
  gender?: string | string[],
  maritalStatus?: string | string[],
  homeCountry?: string | string[],
  homeCity?: string | string[],
  province?: string | string[],
  campus?: string | string[],
  admissionYear?: string | string[],
  passingYear?: string | string[],
  occupationStatus?: string | string[],
  sector?: string | string[],
  workCity?: string | string[],
  workCountry?: string | string[],
  institutionName?: string | string[],
  programEnrolled?: string | string[],
  fundingSource?: string | string[],
  institutionCountry?: string | string[],
  institutionCity?: string | string[],
  mrNo?: string | string[],
  photoConsent?: string | string[],
  sapIdState?: string | string[],
  regNoState?: string | string[]
): Promise<AlumniCounts> {
  const url = new URL("/api/alumni/counts", typeof window !== "undefined" ? window.location.origin : "");
  if (search) {
    url.searchParams.set("search", search);
  }
  if (faculty) {
    if (Array.isArray(faculty)) {
      faculty.forEach(f => url.searchParams.append("faculty", f));
    } else {
      url.searchParams.set("faculty", faculty);
    }
  }
  if (department) {
    if (Array.isArray(department)) {
      department.forEach(d => url.searchParams.append("department", d));
    } else {
      url.searchParams.set("department", department);
    }
  }
  if (program) {
    if (Array.isArray(program)) {
      program.forEach(p => url.searchParams.append("program", p));
    } else {
      url.searchParams.set("program", program);
    }
  }
  
  // Add new filter parameters
  const addFilterParam = (key: string, value: string | string[] | undefined) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }
  };
  
  addFilterParam("gender", gender);
  addFilterParam("maritalStatus", maritalStatus);
  addFilterParam("homeCountry", homeCountry);
  addFilterParam("homeCity", homeCity);
  addFilterParam("province", province);
  addFilterParam("campus", campus);
  addFilterParam("admissionYear", admissionYear);
  addFilterParam("passingYear", passingYear);
  addFilterParam("occupationStatus", occupationStatus);
  addFilterParam("sector", sector);
  addFilterParam("workCity", workCity);
  addFilterParam("workCountry", workCountry);
  addFilterParam("institutionName", institutionName);
  addFilterParam("programEnrolled", programEnrolled);
  addFilterParam("fundingSource", fundingSource);
  addFilterParam("institutionCountry", institutionCountry);
  addFilterParam("institutionCity", institutionCity);
  addFilterParam("mrNo", mrNo);
  addFilterParam("photoConsent", photoConsent);
  addFilterParam("sapIdState", sapIdState);
  addFilterParam("regNoState", regNoState);
  
  const res = await fetch(url.toString(), { signal, headers: { "accept": "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch alumni counts");
  }
  const data = (await res.json()) as AlumniCounts;
  return data;
}

