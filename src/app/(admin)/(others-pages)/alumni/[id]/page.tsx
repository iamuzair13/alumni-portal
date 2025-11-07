import React from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { headers } from "next/headers";

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

function maskPassword(value?: string) {
  if (!value) return "";
  return "\u2022".repeat(Math.max(8, value.length));
}

export default async function AlumniProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  // Resolve absolute base URL for server-side fetch (works locally and behind proxies)
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const base =
    process.env.NEXT_PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "http://localhost:3000");

  let data: AlumniDetail | null = null;
  let error: string | null = null;
  try {
    const apiUrl = new URL(`/api/alumni/${id}`, base).toString();
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load profile (status ${res.status})`);
    }
    data = await res.json();
  } catch (e: any) {
    error = e?.message || "Failed to load profile";
  }

  return (
    <ComponentCard title="Alumni Profile" className="">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200 mb-4">
          {error}
        </div>
      )}

      {!error && data && (
        <div className="space-y-8">
          {/* Personal Information */}
          <section>
            <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Personal Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={data.name} />
              <Field label="Password" value={maskPassword(data.password)} />
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

          {/* Academic Information */}
          <section>
            <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Academic Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Campus" value={data.campus ?? "-"} />
              <Field label="Faculty" value={data.faculty ?? "-"} />
              <Field label="Degree Title" value={data.degreeTitle ?? "-"} />
            </div>
          </section>

          {/* Professional Information */}
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

          {/* Verification Details */}
          <section>
            <h3 className="mb-3 font-semibold text-gray-800 text-theme-lg dark:text-white/90">Verification Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Source" value={data.source ?? "-"} />
              <Field label="Verified" value={data.verified ? "Verified" : "Un-Verified"} />
              <Field label="Category" value={data.category ?? "-"} />
            </div>
          </section>
        </div>
      )}
    </ComponentCard>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <div className="mt-1 text-sm text-gray-800 dark:text-white/90">{value ?? "-"}</div>
    </div>
  );
}
