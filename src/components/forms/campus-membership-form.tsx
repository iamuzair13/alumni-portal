"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import {
  CAMPUS_FACILITY_CONFIG,
  MEMBERSHIP_TYPE_OPTIONS,
  PREFERRED_TIMING_OPTIONS,
  type CampusFacilityType,
} from "@/lib/campusMembership";
import MembershipDatePicker from "@/components/forms/membership-date-picker";

type Props = {
  facilityType: CampusFacilityType;
  alumniId: string;
  sapId: string;
};

const inputBase =
  "px-4 py-3 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const inputReadOnly =
  "px-4 py-3 bg-[#f0f1f2] text-black w-full text-sm border border-gray-200 rounded-md opacity-60 cursor-not-allowed";
const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const buttonPrimary =
  "mt-6 px-5 py-2.5 text-[15px] font-medium w-full max-w-[200px] mx-auto block bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60";

function missing(v: unknown): string {
  const s = String(v ?? "").trim();
  return s ? s : "Data is missing";
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function CampusMembershipForm({ facilityType, alumniId, sapId: sapIdProp }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sapIdFromUrl = searchParams?.get("sapid")?.trim() ?? "";
  const config = CAMPUS_FACILITY_CONFIG[facilityType];

  const [resolvedSapId, setResolvedSapId] = useState("");
  const [resolvingId, setResolvingId] = useState(true);

  const initialSapId = (sapIdProp || sapIdFromUrl).trim();

  useEffect(() => {
    if (initialSapId) {
      setResolvedSapId(initialSapId);
      setResolvingId(false);
      return;
    }

    let cancelled = false;
    setResolvingId(true);
    fetch("/api/alumni/current-sapid")
      .then((res) => res.json())
      .then((data: { sapid?: string }) => {
        if (cancelled) return;
        if (data.sapid) {
          setResolvedSapId(String(data.sapid).trim());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolvingId(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialSapId]);

  const identifier = (initialSapId || resolvedSapId).trim();
  const { data, isLoading, isError, error } = useAlumniFullDetails(identifier || undefined);

  const [membershipType, setMembershipType] = useState("");
  const [membershipStartDate, setMembershipStartDate] = useState("");
  const [preferredTiming, setPreferredTiming] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [physicalDisability, setPhysicalDisability] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");
  const [emergencyContactNumber, setEmergencyContactNumber] = useState("");
  const [alumniCardFile, setAlumniCardFile] = useState<File | null>(null);
  const [cnicFile, setCnicFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileAccept = "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp";

  const applicationDate = formatDisplayDate(new Date());

  useEffect(() => {
    if (!membershipStartDate) {
      setMembershipStartDate(new Date().toISOString().slice(0, 10));
    }
  }, [membershipStartDate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveAlumniId = alumniId || String(data?.alumniid ?? "");
    if (!effectiveAlumniId) {
      toast.error("Alumni account not found. Please ensure you are logged in.");
      return;
    }
    if (!membershipType || !membershipStartDate || !preferredTiming) {
      toast.error("Please complete all required membership details.");
      return;
    }
    if (!emergencyContactName.trim() || !emergencyContactRelationship.trim() || !emergencyContactNumber.trim()) {
      toast.error("Please complete all emergency contact fields.");
      return;
    }
    if (!alumniCardFile || !cnicFile) {
      toast.error("Please upload all required documents.");
      return;
    }
    setIsSubmitting(true);
    try {
      const loadingToast = toast.loading("Submitting your membership application...");
      const fd = new FormData();
      fd.set("alumniId", effectiveAlumniId);
      fd.set("membershipType", membershipType);
      fd.set("membershipStartDate", membershipStartDate);
      fd.set("preferredTiming", preferredTiming);
      fd.set("medicalConditions", medicalConditions.trim());
      fd.set("allergies", allergies.trim());
      fd.set("physicalDisability", physicalDisability.trim());
      fd.set("emergencyContactName", emergencyContactName.trim());
      fd.set("emergencyContactRelationship", emergencyContactRelationship.trim());
      fd.set("emergencyContactNumber", emergencyContactNumber.trim());
      fd.set("alumniCardFile", alumniCardFile);
      fd.set("cnicFile", cnicFile);

      const res = await fetch(config.submitApiPath, {
        method: "POST",
        body: fd,
      });
      toast.dismiss(loadingToast);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Failed to submit application" }));
        throw new Error(errData.error || "Failed to submit application");
      }
      toast.success("Membership application submitted successfully!");
      setTimeout(() => {
        router.push(
          identifier ? `/alumni-profile?sapid=${encodeURIComponent(identifier)}` : "/alumni-profile",
        );
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (resolvingId || (identifier && isLoading)) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!identifier) {
    return (
      <p className="text-sm text-red-600 text-center py-8">
        Unable to identify your alumni account. Please sign in and try again.
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-red-600 text-center py-8">
        {error instanceof Error ? error.message : "Failed to load profile data."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto" aria-label={`${config.applyingFor} membership application form`}>
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">{config.formHeading}</h2>
        <p className="text-sm text-gray-600">{config.formDescription}</p>
        <div className="mt-4 text-sm">
          <span className="font-medium text-slate-700">Application Date: </span>
          <span className="text-slate-900">{applicationDate}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Section title="(a) Alumni Personal Details">
          <Field label="Name" value={missing(data.alumniname)} readOnly />
          <Field label="Father's Name" value={missing(data.fathername)} readOnly />
          <Field label="DOB" value={data.dateofbirth ? new Date(data.dateofbirth).toLocaleDateString("en-GB") : missing(null)} readOnly />
          <Field label="CNIC" value={missing(data.cnicpassport)} readOnly />
        </Section>
        <Section title="(b) Alumni Education Details">
          <Field label="Campus" value={missing(data.campusname)} readOnly />
          <Field label="Faculty" value={missing(data.facultyname)} readOnly />
          <Field label="Department" value={missing(data.departmentname)} readOnly />
          <Field label="Program" value={missing(data.degreetitle)} readOnly />
          <Field label="SAP ID" value={missing(data.sapid)} readOnly />
          <Field label="CGPA" value={missing(data.cgpa)} readOnly />
          <Field label="Passing Out Year" value={missing(data.yearofending)} readOnly fullWidth />
        </Section>
        <Section title="(c) Membership Details">
          <Field label="Applying For" value={config.applyingFor} readOnly />
          <Field label="Discount Type" value={config.discountType} readOnly />
          <div>
            <label htmlFor="membershipType" className={labelBase}>Membership Type <span className="text-red-500">*</span></label>
            <select id="membershipType" value={membershipType} onChange={(e) => setMembershipType(e.target.value)} className={inputBase} required>
              <option value="">Select membership type</option>
              {MEMBERSHIP_TYPE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
          <MembershipDatePicker
            id="membershipStartDate"
            label="Membership Start Date"
            value={membershipStartDate}
            onChange={setMembershipStartDate}
            required
            inputClassName={`${inputBase} pr-10 cursor-pointer`}
            labelClassName={labelBase}
          />
          <div className="sm:col-span-2">
            <label htmlFor="preferredTiming" className={labelBase}>Preferred Timing <span className="text-red-500">*</span></label>
            <select id="preferredTiming" value={preferredTiming} onChange={(e) => setPreferredTiming(e.target.value)} className={inputBase} required>
              <option value="">Select preferred timing</option>
              {PREFERRED_TIMING_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
        </Section>
        <Section title="(d) Medical & Fitness Information">
          <EditableField id="medicalConditions" label="Medical Conditions" value={medicalConditions} onChange={setMedicalConditions} placeholder="None if not applicable" />
          <EditableField id="allergies" label="Allergies" value={allergies} onChange={setAllergies} placeholder="None if not applicable" />
          <EditableField id="physicalDisability" label="Physical Disability" value={physicalDisability} onChange={setPhysicalDisability} placeholder="None if not applicable" fullWidth />
        </Section>
        <Section title="(e) Emergency Contact">
          <EditableField id="emergencyContactName" label="Contact Name" value={emergencyContactName} onChange={setEmergencyContactName} required />
          <EditableField id="emergencyContactRelationship" label="Relationship" value={emergencyContactRelationship} onChange={setEmergencyContactRelationship} required />
          <EditableField id="emergencyContactNumber" label="Contact Number" value={emergencyContactNumber} onChange={setEmergencyContactNumber} required fullWidth type="tel" />
        </Section>
        <Section title="(f) Documents Checklist">
          <DocumentUploadField
            id="alumniCardFile"
            label="Alumni Card"
            file={alumniCardFile}
            onChange={setAlumniCardFile}
            accept={fileAccept}
          />
          <DocumentUploadField
            id="cnicFile"
            label="CNIC"
            file={cnicFile}
            onChange={setCnicFile}
            accept={fileAccept}
          />
          <p className="sm:col-span-2 text-xs text-gray-500">
            Upload PDF or image (JPG, PNG, WEBP). Maximum file size: 5MB per document.
          </p>
        </Section>
      </div>
      <button type="submit" disabled={isSubmitting} className={buttonPrimary}>{isSubmitting ? "Submitting..." : "Submit Application"}</button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2 border border-gray-200 rounded-lg p-4 sm:p-5">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, value, readOnly, fullWidth }: { label: string; value: string; readOnly?: boolean; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <label className={labelBase}>{label}</label>
      <input type="text" value={value} readOnly={readOnly} className={readOnly ? inputReadOnly : inputBase} />
      {readOnly && <p className="mt-1 text-xs text-gray-500">Auto-fetched from your profile</p>}
    </div>
  );
}

function EditableField({ id, label, value, onChange, placeholder, required, fullWidth, type = "text" }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; fullWidth?: boolean; type?: string }) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className={labelBase}>{label} {required && <span className="text-red-500">*</span>}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputBase} placeholder={placeholder} required={required} />
    </div>
  );
}

function DocumentUploadField({
  id,
  label,
  file,
  onChange,
  accept,
}: {
  id: string;
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelBase}>
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className={inputBase}
        required
      />
      {file && (
        <p className="mt-1 text-xs text-gray-600">
          Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}
    </div>
  );
}

