"use client";
import React, { useMemo, useState } from "react";
import type { z } from "zod";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { PencilIcon, CheckLineIcon, CloseLineIcon, ListIcon } from "@/icons";
import {  parseContactNumber, displayCnic } from "./helpers";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAlumniProfile, useUpdateAlumniProfile } from "@/app/queries/alumni-profile";
import Alert from "../ui/alert/Alert";
import { alumniRegistrationComprehensiveSchema, provinces, countries } from "@/lib/alumniRegistration";

type UserMetaCardProps = { sapid: string };

export default function UserMetaCard({ sapid }: UserMetaCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const { data, isLoading, error } = useAlumniProfile(sapid);
  const updateMut = useUpdateAlumniProfile(sapid);

  const [formName, setFormName] = useState<string>("");
  const [formDesignation, setFormDesignation] = useState<string>("");
  const [formHomeCity, setFormHomeCity] = useState<string>("");
  const [formHomeCountry, setFormHomeCountry] = useState<string>("");
  // Inline edit mode state & validation
  const [isEditingInline, setIsEditingInline] = useState<boolean>(false);
  const [draft, setDraft] = useState<Partial<z.input<typeof alumniRegistrationComprehensiveSchema>> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [contactCombined, setContactCombined] = useState<string>("");

  const safeName = useMemo(() => data?.name ?? "-", [data]);
  const safeDesignation = useMemo(() => data?.designation ?? "-", [data]);
  const safeLocation = useMemo(() => {
    const c = data?.homeCity ?? "-";
    const co = data?.homeCountry ?? "-";
    return `${c}, ${co}`;
  }, [data]);

  const normalizeMaritalStatus = (v: unknown): "" | "Married" | "Un-Married" => {
    const s = typeof v === "string" ? v.trim() : "";
    if (s === "Married" || s === "Un-Married") return s;
    return "";
  };

  const handleOpenEdit = () => {
    if (!sapid) return;
    setFormName(data?.name ?? "");
    setFormDesignation(data?.designation ?? "");
    setFormHomeCity(data?.homeCity ?? "");
    setFormHomeCountry(data?.homeCountry ?? "Pakistan");
    openModal();
  };

  const handleToggleInlineEdit = () => {
    if (!data) return;
    setSaveError(null);
    setValidationErrors({});
    if (!isEditingInline) {
      const nextDraft: Partial<z.input<typeof alumniRegistrationComprehensiveSchema>> = {
        sapId: data.sapId ?? "",
        registrationNo: data.registrationNo ?? "",
        name: data.name ?? "",
        fatherName: data.fatherName ?? "",
        gender: data.gender ?? "Other",
        dob: data.dob ?? "",
        maritalStatus: normalizeMaritalStatus(data.maritalStatus),
        personalEmail: data.personalEmail ?? "",
        password: data.password ?? "",
        countryCode: data.countryCode ?? "+92",
        phoneNumber: data.phoneNumber ?? "",
        homeCountry: data.homeCountry ?? "Pakistan",
        province: data.province ?? undefined,
        homeCity: data.homeCity ?? "",
        campus: data.campus ?? "",
        faculty: data.faculty ?? "",
        department: data.department ?? "",
        program: data.program ?? "",
        passingYear: (data.passingYear ?? "").toString(),
        employmentStatus: data.employmentStatus ?? "Unemployed",
        sector: data.sector ?? "",
        subSector: data.subSector ?? "",
        organization: data.organization ?? "",
        designation: data.designation ?? "",
        totalExperienceYears: (data.totalExperienceYears ?? "").toString(),
        officialEmail: data.officialEmail ?? "",
        officialPhone: data.officialPhone ?? "",
        workCity: data.workCity ?? "",
        workCountry: data.workCountry ?? undefined,
        source: data.source ?? "",
        verified: Boolean(data.verified ?? false),
        category: data.category ?? "",
      };
      setDraft(nextDraft);
      setContactCombined(`${data.countryCode ?? ""} ${data.phoneNumber ?? ""}`.trim());
      setIsEditingInline(true);
    } else {
      setIsEditingInline(false);
      setDraft(null);
      setContactCombined("");
    }
  };

  const handleInlineCancel = () => {
    setIsEditingInline(false);
    setDraft(null);
    setSaveError(null);
    setValidationErrors({});
    setContactCombined("");
  };

  const handleInlineSave = async () => {
    if (!data || !draft) {
      setIsEditingInline(false);
      return;
    }
    try {
      setSaveError(null);
      setValidationErrors({});

      draft.maritalStatus = normalizeMaritalStatus(draft.maritalStatus);
      if (contactCombined) {
        const parsedContact = parseContactNumber(contactCombined);
        if (!parsedContact.valid) {
          const v = { ...validationErrors, phoneNumber: "Invalid phone format. Use +[code] [number]" };
          setValidationErrors(v);
          setSaveError("Please fix the highlighted fields.");
          return;
        }
        draft.countryCode = parsedContact.code;
        draft.phoneNumber = parsedContact.number;
      }
      const parsed = alumniRegistrationComprehensiveSchema.safeParse(draft);
      if (!parsed.success) {
        const vErrs: Record<string, string> = {};
        parsed.error.issues.forEach((iss) => {
          const key = Array.isArray(iss.path) && iss.path.length ? String(iss.path[0]) : "form";
          vErrs[key] = iss.message;
        });
        setValidationErrors(vErrs);
        setSaveError("Please fix the highlighted fields.");
        return;
      }
      await updateMut.mutateAsync({
        ...data,
        ...parsed.data,
      });
      setIsEditingInline(false);
      setDraft(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save changes.";
      setSaveError(msg);
    }
  };



  const handleSave = async () => {
    if (!data) return closeModal();
    try {
      setSaveError(null);
      setValidationErrors({});
      const merged = {
        ...data,
        name: formName || data.name,
        designation: formDesignation || data.designation,
        homeCity: formHomeCity || data.homeCity,
        homeCountry:
          (formHomeCountry as
            | "United Kingdom"
            | "Pakistan"
            | "France"
            | "China"
            | "Canada"
            | "Saudi Arabia"
            | "Germany"
            | "United States"
            | "United Arab Emirates"
            | "Australia") || data.homeCountry,
      };
      merged.maritalStatus = normalizeMaritalStatus(merged.maritalStatus);

      const parsed = alumniRegistrationComprehensiveSchema.safeParse(merged);
      if (!parsed.success) {
        const vErrs: Record<string, string> = {};
        parsed.error.issues.forEach((iss) => {
          const key = Array.isArray(iss.path) && iss.path.length ? String(iss.path[0]) : "form";
          vErrs[key] = iss.message;
        });
        setValidationErrors(vErrs);
        setSaveError("Please fix the highlighted fields.");
        return;
      }
      await updateMut.mutateAsync(parsed.data);
      closeModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save changes.";
      setSaveError(msg);
    }
  };



  const handleInlineChange = (key: string, value: string | number | boolean) => {
    setDraft((prev) => ({ ...(prev ?? {}), [key]: value }));
  };

 
 
  return (
    <>
      <section
        aria-labelledby="user-meta-heading"
        className="p-5  rounded-2xl bg-white/90 backdrop-blur-sm shadow-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="order-3 xl:order-2">
              {isLoading ? (
                <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
              ) : error ? (
                <h4 className="mb-2 text-sm font-medium text-rose-600 xl:text-left" role="status">Failed to load</h4>
              ) : (
                <h4
                  id="user-meta-heading"
                  className="mb-2 text-[30px] font-semibold text-center text-gray-900 tracking-tight dark:text-white/90 xl:text-left"
                >
                  {safeName}
                </h4>
              )}
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                {isLoading ? (
                  <div className="h-5 w-24 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
                ) : (
                  <p className="text-lg text-gray-600 dark:text-gray-400" aria-live="polite">
                    {safeDesignation}
                  </p>
                )}
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                {isLoading ? (
                  <div className="h-5 w-40 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
                ) : (
                  <p className="text-lg text-gray-600 dark:text-gray-400" aria-live="polite">
                    {safeLocation}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full items-center justify-center gap-3 lg:inline-flex lg:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenEdit}
              className="focus-visible:ring-2 focus-visible:ring-primary"
              startIcon={<PencilIcon />}
              aria-controls="user-meta-edit-modal"
              aria-label="Edit personal information"
              disabled={isLoading || !!error}
            >
              Edit
            </Button>
            <Button
              size="sm"
              onClick={handleToggleInlineEdit}
              className="focus-visible:ring-2 focus-visible:ring-primary"
              startIcon={<ListIcon />}
              aria-expanded={isEditingInline}
              aria-controls="user-meta-inline-form"
              aria-label={isEditingInline ? "Close inline edit" : "Open inline edit"}
              disabled={!!error}
            >
              {isEditingInline ? "Close Inline Edit" : "Inline Edit"}
            </Button>
          </div>
        </div>
        {/* Details grid mapped from normalized profile data */}
        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4  lg:grid-cols-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl   bg-gray-50 p-3 shadow-xs dark:border-gray-800 dark:bg-white/[0.02]">
                <div className="h-3 w-24 bg-gray-200 animate-pulse rounded mb-2" aria-hidden="true" />
                <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
            Failed to load profile details.
          </div>
        ) : (
          !isEditingInline ? (
          <dl className="mt-6 grid grid-cols-1 gap-3  sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["Email", data?.personalEmail ?? "-"],
              ["Password", data?.password ?? "-"],
              ["Registration No", data?.registrationNo ?? "-"],
              ["Sap-ID", data?.sapId ?? "-"],
              ["Gender", data?.gender ?? "-"],
              ["Father Name", data?.fatherName ?? "-"],
              ["Date of Birth", data?.dob ?? "-"],
              ["Marital Status", data?.maritalStatus ?? "-"],
              ["CNIC/Passport", data?.cnicOrPassport ?? "-"],
              ["Contact No", `${data?.countryCode ?? ""} ${data?.phoneNumber ?? ""}`.trim() || "-"],
              ["Country", data?.homeCountry ?? "-"],
              ["Province", data?.province ?? "-"],
              ["City", data?.homeCity ?? "-"],
              ["Address", data?.address ?? "-"],
              ["Academic Session", "-"],
              ["Degree Title", data?.program ?? "-"],
              ["Passing Year", (data?.passingYear ?? "-").toString()],
              ["Faculty Name", data?.faculty ?? "-"],
              ["Campus Name", data?.campus ?? "-"],
              ["Department Name", data?.department ?? "-"],
              ["Industry", data?.sector ?? "-"],
              ["Employment Status", data?.employmentStatus ?? "-"],
              ["Organization Name", data?.organization ?? "-"],
              ["Designation", data?.designation ?? "-"],
              ["Total Years of Experience", (data?.totalExperienceYears ?? "-").toString()],
              ["Verified", String(data?.verified ?? false)],
              ["Data Source", data?.source ?? "-"],
              ["Alumni Status", data?.category ?? "-"],
            ] as Array<[string, string]>).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl p-3  transition-colors duration-150  dark:border-gray-800 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
              >
                <dt className="mb-1 text-[16px] font-bold leading-normal  text-gray-900 dark:text-gray-400">{label}</dt>
                <dd className="text-[16px] text-gray-600 break-words dark:text-white/90">{value ?? "-"}</dd>
              </div>
            ))}
          </dl>
          ) : (
            <form id="user-meta-inline-form" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-3 mb-2">
                <Button size="sm" variant="outline" onClick={handleInlineCancel} className="focus-visible:ring-2 focus-visible:ring-primary" startIcon={<CloseLineIcon />} aria-label="Cancel inline edit">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleInlineSave} className="focus-visible:ring-2 focus-visible:ring-primary" startIcon={<CheckLineIcon />} disabled={updateMut.isPending} aria-busy={updateMut.isPending} aria-label="Save inline edits">
                  {updateMut.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
              {/* Email */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Email</dt>
                <Input type="text" value={(draft?.personalEmail ?? "") as string} onChange={(e) => handleInlineChange("personalEmail", e.target.value)} className="focus-visible:ring-primary" />
                {validationErrors["personalEmail"] && <p className="mt-1 text-sm text-rose-600">{validationErrors["personalEmail"]}</p>}
              </div>
              {/* Password */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Password</dt>
                <Input type="password" value={(draft?.password ?? "") as string} onChange={(e) => handleInlineChange("password", e.target.value)} className="focus-visible:ring-primary" />
                {validationErrors["password"] && <p className="mt-1 text-sm text-rose-600">{validationErrors["password"]}</p>}
              </div>
              {/* Registration No */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Registration No</dt>
                <Input type="text" value={(draft?.registrationNo ?? "") as string} onChange={(e) => handleInlineChange("registrationNo", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Sap-ID */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Sap-ID</dt>
                <Input type="text" value={(draft?.sapId ?? "") as string} onChange={(e) => handleInlineChange("sapId", e.target.value)} className="focus-visible:ring-primary" />
                {validationErrors["sapId"] && <p className="mt-1 text-sm text-rose-600">{validationErrors["sapId"]}</p>}
              </div>
              {/* Gender */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Gender</dt>
                <select value={(draft?.gender ?? "") as string} onChange={(e) => handleInlineChange("gender", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {["Male","Female","Other"].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {/* Father Name */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Father Name</dt>
                <Input type="text" value={(draft?.fatherName ?? "") as string} onChange={(e) => handleInlineChange("fatherName", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Date of Birth */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Date of Birth</dt>
                <Input type="text" value={(draft?.dob ?? "") as string} onChange={(e) => handleInlineChange("dob", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Marital Status */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Marital Status</dt>
                <select value={(draft?.maritalStatus ?? "") as string} onChange={(e) => handleInlineChange("maritalStatus", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <option value="">Select</option>
                  {["Married", "Un-Married"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {/* CNIC/Passport (read-only from DB) */}
              <div className="rounded-xl p-3 sm:col-span-2">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">CNIC/Passport</dt>
                <Input type="text" value={displayCnic(data?.cnicOrPassport as string | undefined)} disabled aria-disabled="true" className="focus-visible:ring-primary" />
              </div>
              {/* Contact Number (single field) */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Contact Number</dt>
                <Input
                  type="text"
                  value={contactCombined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContactCombined(val);
                    const p = parseContactNumber(val);
                    if (!p.valid) {
                      setValidationErrors({ ...validationErrors, phoneNumber: "Invalid phone format. Use +[code] [number]" });
                    } else {
                      const v = { ...validationErrors };
                      delete v.phoneNumber;
                      setValidationErrors(v);
                    }
                    handleInlineChange("countryCode", p.code);
                    handleInlineChange("phoneNumber", p.number);
                  }}
                  className="focus-visible:ring-primary"
                  placeholder="e.g. +92 3001234567"
                  aria-label="Contact number"
                />
                {validationErrors["phoneNumber"] && <p className="mt-1 text-sm text-rose-600">{validationErrors["phoneNumber"]}</p>}
              </div>
              {/* Country/Province/City */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Country</dt>
                <select value={(draft?.homeCountry ?? "") as string} onChange={(e) => handleInlineChange("homeCountry", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Province</dt>
                <select value={(draft?.province ?? "") as string} onChange={(e) => handleInlineChange("province", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <option value="">Select</option>
                  {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">City</dt>
                <Input type="text" value={(draft?.homeCity ?? "") as string} onChange={(e) => handleInlineChange("homeCity", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Address */}
              <div className="rounded-xl p-3 sm:col-span-2 lg:col-span-2">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Address</dt>
                <Input type="text" value={(draft?.address ?? "") as string} onChange={(e) => handleInlineChange("address", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Academic Session placeholder */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Academic Session</dt>
                <dd className="text-[16px] text-gray-600 dark:text-white/90">-</dd>
              </div>
              {/* Program */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Degree Title</dt>
                <Input type="text" value={(draft?.program ?? "") as string} onChange={(e) => handleInlineChange("program", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Passing Year */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Passing Year</dt>
                <Input type="text" value={(draft?.passingYear ?? "") as string} onChange={(e) => handleInlineChange("passingYear", e.target.value)} className="focus-visible:ring-primary" />
                {validationErrors["passingYear"] && <p className="mt-1 text-sm text-rose-600">{validationErrors["passingYear"]}</p>}
              </div>
              {/* Faculty/Campus/Department */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Faculty Name</dt>
                <Input type="text" value={(draft?.faculty ?? "") as string} onChange={(e) => handleInlineChange("faculty", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Campus Name</dt>
                <Input type="text" value={(draft?.campus ?? "") as string} onChange={(e) => handleInlineChange("campus", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Department Name</dt>
                <Input type="text" value={(draft?.department ?? "") as string} onChange={(e) => handleInlineChange("department", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Industry / Employment Status */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Industry</dt>
                <Input type="text" value={(draft?.sector ?? "") as string} onChange={(e) => handleInlineChange("sector", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Employment Status</dt>
                <select value={(draft?.employmentStatus ?? "") as string} onChange={(e) => handleInlineChange("employmentStatus", e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {["Employed","Unemployed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Organization / Designation / Experience */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Organization Name</dt>
                <Input type="text" value={(draft?.organization ?? "") as string} onChange={(e) => handleInlineChange("organization", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Designation</dt>
                <Input type="text" value={(draft?.designation ?? "") as string} onChange={(e) => handleInlineChange("designation", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Total Years of Experience</dt>
                <Input type="text" value={(draft?.totalExperienceYears ?? "") as string} onChange={(e) => handleInlineChange("totalExperienceYears", e.target.value)} className="focus-visible:ring-primary" />
                {validationErrors["totalExperienceYears"] && <p className="mt-1 text-sm text-rose-600">{validationErrors["totalExperienceYears"]}</p>}
              </div>
              {/* Verified */}
              <div className="rounded-xl p-3">
                <dt className="mb-2 text-[16px] font-bold text-gray-900 dark:text-gray-400">Verified</dt>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={Boolean(draft?.verified)} onChange={(e) => handleInlineChange("verified", e.target.checked)} className="rounded" />
                  Verified
                </label>
              </div>
              {/* Data Source */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Data Source</dt>
                <Input type="text" value={(draft?.source ?? "") as string} onChange={(e) => handleInlineChange("source", e.target.value)} className="focus-visible:ring-primary" />
              </div>
              {/* Alumni Status */}
              <div className="rounded-xl p-3">
                <dt className="mb-1 text-[16px] font-bold text-gray-900 dark:text-gray-400">Alumni Status</dt>
                <Input type="text" value={(draft?.category ?? "") as string} onChange={(e) => handleInlineChange("category", e.target.value)} className="focus-visible:ring-primary" />
              </div>

              {(saveError || updateMut.isSuccess) && (
                <div className="sm:col-span-2 lg:col-span-4">
                  {saveError ? (
                    <Alert variant="error" title="Update Failed" message={saveError} />
                  ) : (
                    <Alert variant="success" title="Profile Updated" message="Your changes have been saved." />
                  )}
                </div>
              )}
            </form>
          )
        )}
      </section>
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div
          id="user-meta-edit-modal"
          className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 shadow-lg ring-1 ring-gray-100 transition-shadow duration-150 dark:bg-gray-900 lg:p-11"
        >
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-900 tracking-tight dark:text-white/90">
              Edit Personal Information
            </h4>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 lg:mb-7">
              Update your details to keep your profile up-to-date.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div className="mt-2">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Personal Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label>First Name</Label>
                    <Input
                      type="text"
                      value={(formName.split(" ")[0] ?? "")}
                      onChange={(e) => {
                        const last = formName.split(" ").slice(1).join(" ");
                        const first = e.target.value;
                        setFormName(`${first}${last ? ` ${last}` : ""}`);
                      }}
                      className="focus-visible:ring-primary"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Last Name</Label>
                    <Input
                      type="text"
                      value={formName.split(" ").slice(1).join(" ")}
                      onChange={(e) => {
                        const first = formName.split(" ")[0] ?? "";
                        const last = e.target.value;
                        setFormName(`${first}${last ? ` ${last}` : ""}`);
                      }}
                      className="focus-visible:ring-primary"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Email Address</Label>
                    <Input type="text" value={data?.personalEmail ?? ""} disabled aria-disabled="true" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Phone</Label>
                    <Input type="text" value={`${data?.countryCode ?? "+92"} ${data?.phoneNumber ?? ""}`} disabled aria-disabled="true" />
                  </div>

                  <div className="col-span-2">
                    <Label>Bio</Label>
                    <Input
                      type="text"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      className="focus-visible:ring-primary"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>City</Label>
                    <Input type="text" value={formHomeCity} onChange={(e) => setFormHomeCity(e.target.value)} className="focus-visible:ring-primary" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Country</Label>
                    <Input type="text" value={formHomeCountry} onChange={(e) => setFormHomeCountry(e.target.value)} className="focus-visible:ring-primary" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal} className="focus-visible:ring-2 focus-visible:ring-primary" startIcon={<CloseLineIcon />} aria-label="Close edit dialog">
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMut.isPending}
                className="focus-visible:ring-2 focus-visible:ring-primary"
                aria-busy={updateMut.isPending}
                startIcon={<CheckLineIcon />}
                aria-label="Save changes"
              >
                {updateMut.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
            {(saveError || updateMut.isSuccess) && (
              <div className="mt-4 px-2">
                {saveError ? (
                  <Alert variant="error" title="Update Failed" message={saveError} />
                ) : (
                  <Alert variant="success" title="Profile Updated" message="Your changes have been saved." />
                )}
              </div>
            )}
          </form>
        </div>
      </Modal>
    </>
  );
}
