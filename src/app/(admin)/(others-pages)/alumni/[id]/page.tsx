"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { useParams } from "next/navigation";

type AlumniDetail = {
  id: string;
  name: string;
  password?: string;
  email?: string;
  gender?: string;
  cnicOrPassport?: string;
  address?: string;
  province?: string;
  homeCity?: string;
  homeCountry?: string;
  maritalStatus?: string;
  dob?: string;
  campus?: string;
  faculty?: string;
  degreeTitle?: string;
  sector?: string;
  subSector?: string;
  organization?: string;
  designation?: string;
  experienceDuration?: string;
  source?: string;
  verified?: boolean;
  category?: string;
};



type AlumniApiResponse = { item?: Record<string, unknown> };

export default function AlumniProfilePage() {
  const params = useParams() as { id?: string };
  const id = String(params?.id || "");

  const [data, setData] = useState<AlumniDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const getAlumniDetail = useCallback(async (sapid: string): Promise<AlumniDetail> => {
    const res = await fetch(`/api/alumni/${encodeURIComponent(sapid)}`, { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as AlumniApiResponse | Record<string, unknown>;
      const msg = (j && typeof j === "object" && "error" in j) ? String((j as Record<string, unknown>).error ?? "") : "";
      throw new Error(msg || `Failed (${res.status})`);
    }
    const j = (await res.json()) as AlumniApiResponse;
    const item = j.item || {};
    const d: AlumniDetail = {
      id: sapid,
      name: String((item as Record<string, unknown>).name || ""),
      password: String((item as Record<string, unknown>).password || ""),
      email: String((item as Record<string, unknown>).personalEmail || (item as Record<string, unknown>).officialEmail || ""),
      gender: String((item as Record<string, unknown>).gender || ""),
      cnicOrPassport: String((item as Record<string, unknown>).cnicOrPassport || ""),
      address: String((item as Record<string, unknown>).address || ""),
      province: String((item as Record<string, unknown>).province || ""),
      homeCity: String((item as Record<string, unknown>).homeCity || ""),
      homeCountry: String((item as Record<string, unknown>).homeCountry || ""),
      maritalStatus: String((item as Record<string, unknown>).maritalStatus || ""),
      dob: String((item as Record<string, unknown>).dob || ""),
      campus: String((item as Record<string, unknown>).campus || ""),
      faculty: String((item as Record<string, unknown>).faculty || ""),
      degreeTitle: String((item as Record<string, unknown>).program || ""),
      sector: (item as Record<string, unknown>).sector ? String((item as Record<string, unknown>).sector) : undefined,
      subSector: (item as Record<string, unknown>).subSector ? String((item as Record<string, unknown>).subSector) : undefined,
      organization: (item as Record<string, unknown>).organization ? String((item as Record<string, unknown>).organization) : undefined,
      designation: (item as Record<string, unknown>).designation ? String((item as Record<string, unknown>).designation) : undefined,
      experienceDuration: (item as Record<string, unknown>).totalExperienceYears ? String((item as Record<string, unknown>).totalExperienceYears) : undefined,
      source: (item as Record<string, unknown>).source ? String((item as Record<string, unknown>).source) : undefined,
      verified: !!(item as Record<string, unknown>).verified,
      category: (item as Record<string, unknown>).category ? String((item as Record<string, unknown>).category) : undefined,
    };
    return d;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    if (!id) {
      setError("Missing alumni id");
      setLoading(false);
      return;
    }
    getAlumniDetail(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, refreshTick, getAlumniDetail]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200 mb-4">
          {error}
        </div>
      );
    }
    if (!data) return null;
    return (
      <div className="space-y-8">
        <section>
          <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Personal Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={data.name} />
            <Field label="Password" value={(data.password)} />
            <Field label="Email" value={data.email ?? "-"} />
            <Field label="Gender" value={data.gender ?? "-"} />
            <Field label="CNIC/Passport" value={data.cnicOrPassport ?? "-"} />
            <Field label="Address" value={data.address ?? "-"} />
            <Field label="Province" value={data.province ?? "-"} />
            <Field label="Home City" value={data.homeCity ?? "-"} />
            <Field label="Home Country" value={data.homeCountry ?? "-"} />
            <Field label="Marital Status" value={data.maritalStatus ?? "-"} />
            <Field label="DOB" value={data.dob ?? "-"} />
          </div>
        </section>
        <section>
          <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Academic Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Campus" value={data.campus ?? "-"} />
            <Field label="Faculty" value={data.faculty ?? "-"} />
            <Field label="Degree Title" value={data.degreeTitle ?? "-"} />
          </div>
        </section>
        <section>
          <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Professional Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Sector" value={data.sector ?? "-"} />
            <Field label="Sub Sector" value={data.subSector ?? "-"} />
            <Field label="Organization/Institute" value={data.organization ?? "-"} />
            <Field label="Designation" value={data.designation ?? "-"} />
            <Field label="Experience/Duration" value={data.experienceDuration ?? "-"} />
          </div>
        </section>
        <section>
          <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Verification Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Source" value={data.source ?? "-"} />
            <Field label="Verified" value={data.verified ? "Verified" : "Un-Verified"} />
            <Field label="Category" value={data.category ?? "-"} />
          </div>
        </section>
      </div>
    );
  }, [loading, error, data]);

  return (
    <ComponentCard title="Alumni Profile" className="">
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ID: <span className="font-mono text-gray-900 dark:text-gray-100">{id}</span></span>
        <button 
          type="button" 
          onClick={() => setRefreshTick((x) => x + 1)} 
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      {content}
    </ComponentCard>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/60">
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</span>
      <div className="text-sm font-medium text-gray-900 dark:text-white/90">{value ?? "-"}</div>
    </div>
  );
}
