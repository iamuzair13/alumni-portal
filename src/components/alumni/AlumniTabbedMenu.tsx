"use client";
import React, { useMemo, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import { AlumniTabs } from "@/components/alumni/Alumni-tabs";
import { AlumniCards } from "@/components/alumni/Alumini-cards";
import { AlumniParticipation } from "@/components/alumni/Alumni-participation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  alumniRegistrationComprehensiveSchema,
  type AlumniRegistrationComprehensiveForm as AlumniRegistrationFormValues,
  provinces,
  countries,
  passwordStrength,
} from "@/lib/alumniRegistration";
import { createAlumni, getAlumniBySapId, updateAlumniBySapId, deleteAlumniBySapId } from "@/services/alumniService";


type MenuKey = "AlumniTabs" | "AlumniCards" | "AlumniParticipation" | "AadAlumni";

const MENU_TABS: { key: MenuKey; label: string }[] = [
  { key: "AlumniTabs", label: "Alumni Status" },
  { key: "AlumniCards", label: "Alumni Cards" },
  { key: "AlumniParticipation", label: "Alumni Participation" },
  { key: "AadAlumni", label: "Add Alumni" },
];

export const AlumniTabbedMenu: React.FC = () => {
  const [selected, setSelected] = useState<MenuKey>("AlumniTabs");

  return (
    <ComponentCard className="">
      <div
        className="tab-list  flex flex-wrap gap-3 lg:gap-4 justify-start"
        role="tablist"
        aria-label="Alumni sections"
      >
        {MENU_TABS.map((tab, idx) => (
          <button
            key={tab.key}
            className={`rounded-xl border px-4 py-2 cursor-pointer transform scale-100 transform-gpu transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-sm hover:border-blue-400 ${
              selected === tab.key
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-gray-200 bg-slate-100 text-gray-700 dark:border-gray-800 dark:bg-white/[0.03]"
            }`}
            onClick={() => setSelected(tab.key)}
            role="tab"
            aria-selected={selected === tab.key}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                const nextIdx = (idx + 1) % MENU_TABS.length;
                setSelected(MENU_TABS[nextIdx].key);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const prevIdx = (idx - 1 + MENU_TABS.length) % MENU_TABS.length;
                setSelected(MENU_TABS[prevIdx].key);
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(tab.key);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className=" ">
        {selected === "AlumniTabs" && <AlumniTabs />}
        {selected === "AlumniCards" && <AlumniCards />}
        {selected === "AlumniParticipation" && <AlumniParticipation />}
        {selected === "AadAlumni" && <AlumniRegistrationFormComponent />}
      </div>

      <style jsx>{`
        .tab-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        @media (min-width: 1024px) {
          .tab-list { gap: 1rem; }
        }
      `}</style>
    </ComponentCard>
  );
};

export const AlumniRegistrationFormComponent: React.FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    trigger,
  } = useForm<AlumniRegistrationFormValues>({
    resolver: zodResolver(alumniRegistrationComprehensiveSchema) as any,
    defaultValues: { homeCountry: "Pakistan", employmentStatus: "Unemployed" },
    mode: "onBlur",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingSapId, setEditingSapId] = useState<string | null>(null);
  const pwd = watch("password") || "";
  const strength = useMemo(() => passwordStrength(pwd), [pwd]);

  const onSubmit = async (data: AlumniRegistrationFormValues) => {
    setSubmitting(true);
    setSubmitMsg(null);
    setServerErrors(null);
    try {
      if (editingSapId) {
        const res = await updateAlumniBySapId(editingSapId, data);
        setSubmitMsg(`Updated successfully for SAP ID ${res.updated.sapid}.`);
      } else {
        const res = await createAlumni(data);
        setSubmitMsg(`Created successfully. Alumni ID ${res.created.alumniid}.`);
        reset();
      }
    } catch (e) {
      let msg = e instanceof Error ? e.message : "Submission failed";
      try {
        const parsed = typeof msg === "string" ? JSON.parse(msg) : null;
        if (parsed?.fieldErrors) {
          setServerErrors(parsed.fieldErrors as Record<string, string[]>);
          msg = "Please correct the highlighted errors.";
        }
      } catch {}
      setSubmitMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Multi-step state and helpers
  const [step, setStep] = useState<number>(1);
  const totalSteps = 3;
  const [stepError, setStepError] = useState<string | null>(null);

  const step1Fields: (keyof AlumniRegistrationFormValues)[] = [
    "registrationNo",
    "sapId",
    "name",
    "fatherName",
    "gender",
    "dob",
    "maritalStatus",
    "cnicOrPassport",
    "countryCode",
    "phoneNumber",
    "personalEmail",
    "password",
  ];
  const step2Fields: (keyof AlumniRegistrationFormValues)[] = [
    "address",
    "province",
    "homeCity",
    "homeCountry",
  ];
  const step3Fields: (keyof AlumniRegistrationFormValues)[] = [
    "campus",
    "faculty",
    "department",
    "program",
    "passingYear",
    "employmentStatus",
    "sector",
    "subSector",
    "organization",
    "designation",
    "totalExperienceYears",
    "officialEmail",
    "officialPhone",
    "workCity",
    "workCountry",
    "source",
    "verified",
    "category",
  ];

  const validateCurrentStep = async () => {
    const fields = step === 1 ? step1Fields : step === 2 ? step2Fields : step3Fields;
    const valid = await trigger(fields);
    setStepError(valid ? null : "Please correct the highlighted fields to continue.");
    return valid;
  };

  const handleNext = async () => {
    const ok = await validateCurrentStep();
    if (ok) setStep((s) => Math.min(totalSteps, s + 1));
  };
  const handlePrev = () => setStep((s) => Math.max(1, s - 1));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6" aria-label="Alumni registration form">
      {/* Progress indicator */}
      <div className="mb-6">
        <div
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label="Registration progress"
          className="h-2 w-full rounded bg-neutral-200"
        >
          <div className="h-2 rounded bg-indigo-400 transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
        <ol className="mt-3 flex items-center justify-between text-sm text-neutral-700" aria-label="Form steps">
          <li aria-current={step === 1 ? "step" : undefined} className={`flex-1 text-center ${step >= 1 ? "font-semibold text-indigo-700" : "text-neutral-500"}`}>Personal</li>
          <li aria-current={step === 2 ? "step" : undefined} className={`flex-1 text-center ${step >= 2 ? "font-semibold text-indigo-700" : "text-neutral-500"}`}>Address</li>
          <li aria-current={step === 3 ? "step" : undefined} className={`flex-1 text-center ${step >= 3 ? "font-semibold text-indigo-700" : "text-neutral-500"}`}>Additional</li>
        </ol>
      </div>
      {/* Edit / Load existing by SAP ID */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end" aria-label="Load existing record">
        <div className="flex-1">
          <label htmlFor="edit-sapid" className="block text-sm text-neutral-700">Edit by SAP ID</label>
          <div className="mt-1 flex gap-2">
            <input id="edit-sapid" type="text" placeholder="Enter SAP ID" value={editingSapId ?? ""} onChange={(e) => setEditingSapId(e.target.value || null)} className="w-full rounded border border-neutral-300 p-2" />
            <button type="button" onClick={async () => {
              if (!editingSapId) return;
              setLoadingRecord(true);
              setSubmitMsg(null);
              setServerErrors(null);
              try {
                const res = await getAlumniBySapId(editingSapId);
                reset(res.item);
                setSubmitMsg(`Loaded record for SAP ID ${editingSapId}.`);
              } catch (err: any) {
                setSubmitMsg(err?.message ?? "Failed to load record");
              } finally {
                setLoadingRecord(false);
              }
            }} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Load</button>
            {editingSapId && (
              <button type="button" onClick={async () => {
                setDeleting(true);
                setSubmitMsg(null);
                try {
                  await deleteAlumniBySapId(editingSapId);
                  setSubmitMsg(`Deleted record for SAP ID ${editingSapId}.`);
                  setEditingSapId(null);
                  reset();
                } catch (err: any) {
                  setSubmitMsg(err?.message ?? "Delete failed");
                } finally {
                  setDeleting(false);
                }
              }} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-red-700 hover:bg-red-50">Delete</button>
            )}
          </div>
        </div>
        {(loadingRecord || deleting || submitting || submitMsg) && (
          <div className="sm:w-1/3">
            {loadingRecord && <div className="text-sm text-neutral-600">Loading...</div>}
            {deleting && <div className="text-sm text-neutral-600">Deleting...</div>}
            {submitting && <div className="text-sm text-neutral-600">Submitting...</div>}
            {submitMsg && <div role="alert" className="text-sm text-neutral-800">{submitMsg}</div>}
          </div>
        )}
      </div>
      {/* Personal Information */}
      <section
        aria-labelledby="personal-info-heading"
        className={`mb-6 ${step === 1 ? "animate-[fadeInUp_.3s_ease]" : "hidden"}`}
        aria-hidden={step !== 1}
      >
        <h2 id="personal-info-heading" className="text-lg font-semibold text-neutral-800">Personal Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="registrationNo" className="block text-sm text-neutral-700">Registration #</label>
            <input id="registrationNo" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("registrationNo")} aria-invalid={!!errors.registrationNo || undefined} aria-describedby={errors.registrationNo ? "registrationNo-error" : undefined} />
            {errors.registrationNo && <p id="registrationNo-error" role="alert" className="mt-1 text-xs text-red-600">{errors.registrationNo.message}</p>}
            {serverErrors?.registrationNo && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.registrationNo[0]}</p>}
          </div>
          <div>
            <label htmlFor="sapId" className="block text-sm text-neutral-800">SAP ID *</label>
            <input id="sapId" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("sapId")} aria-required="true" aria-invalid={!!errors.sapId || undefined} aria-describedby={errors.sapId ? "sapId-error" : undefined} />
            {errors.sapId && <p id="sapId-error" role="alert" className="mt-1 text-xs text-red-600">{errors.sapId.message}</p>}
            {serverErrors?.sapId && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.sapId[0]}</p>}
          </div>
          <div>
            <label htmlFor="name" className="block text-sm text-neutral-800">Name *</label>
            <input id="name" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("name")} aria-required="true" aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? "name-error" : undefined} />
            {errors.name && <p id="name-error" role="alert" className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            {serverErrors?.name && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.name[0]}</p>}
          </div>
          <div>
            <label htmlFor="fatherName" className="block text-sm text-neutral-700">Father Name</label>
            <input id="fatherName" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("fatherName")} aria-invalid={!!errors.fatherName || undefined} aria-describedby={errors.fatherName ? "fatherName-error" : undefined} />
            {errors.fatherName && <p id="fatherName-error" role="alert" className="mt-1 text-xs text-red-600">{errors.fatherName.message}</p>}
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm text-neutral-800">Gender *</label>
            <select id="gender" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("gender")} aria-required="true" aria-invalid={!!errors.gender || undefined} aria-describedby={errors.gender ? "gender-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            {errors.gender && <p id="gender-error" role="alert" className="mt-1 text-xs text-red-600">{errors.gender.message}</p>}
            {serverErrors?.gender && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.gender[0]}</p>}
          </div>
          <div>
            <label htmlFor="dob" className="block text-sm text-neutral-700">Date of Birth</label>
            <input id="dob" type="date" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("dob")} aria-invalid={!!errors.dob || undefined} aria-describedby={errors.dob ? "dob-error" : undefined} />
            {errors.dob && <p id="dob-error" role="alert" className="mt-1 text-xs text-red-600">{errors.dob.message}</p>}
            {serverErrors?.dob && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.dob[0]}</p>}
          </div>
          <div>
            <label htmlFor="maritalStatus" className="block text-sm text-neutral-700">Marital Status</label>
            <select id="maritalStatus" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("maritalStatus")} aria-invalid={!!errors.maritalStatus || undefined} aria-describedby={errors.maritalStatus ? "maritalStatus-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Single</option>
              <option>Married</option>
              <option>Divorced</option>
            </select>
            {errors.maritalStatus && <p id="maritalStatus-error" role="alert" className="mt-1 text-xs text-red-600">{errors.maritalStatus.message}</p>}
          </div>
          <div>
            <label htmlFor="cnicOrPassport" className="block text-sm text-neutral-800">CNIC/Passport #</label>
            <input id="cnicOrPassport" placeholder="12345-1234567-1 or Passport" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("cnicOrPassport")} aria-invalid={!!errors.cnicOrPassport || undefined} aria-describedby={errors.cnicOrPassport ? "cnicOrPassport-error" : undefined} />
            {errors.cnicOrPassport && <p id="cnicOrPassport-error" role="alert" className="mt-1 text-xs text-red-600">{errors.cnicOrPassport.message}</p>}
            {serverErrors?.cnicOrPassport && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.cnicOrPassport[0]}</p>}
          </div>
          <div>
            <label className="block text-sm text-neutral-800">Mobile No. *</label>
            <div className="mt-1 flex gap-2">
              <input aria-label="Country code" placeholder="+92" className="w-24 rounded border border-neutral-300 p-2" {...register("countryCode")} aria-required="true" aria-invalid={!!errors.countryCode || undefined} aria-describedby={errors.countryCode ? "countryCode-error" : undefined} />
              <input aria-label="Phone number" placeholder="3001234567" className="flex-1 rounded border border-neutral-300 p-2" {...register("phoneNumber")} aria-required="true" aria-invalid={!!errors.phoneNumber || undefined} aria-describedby={errors.phoneNumber ? "phoneNumber-error" : undefined} />
            </div>
            {(errors.countryCode || errors.phoneNumber) && (
              <p id="countryCode-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.countryCode?.message || errors.phoneNumber?.message}
              </p>
            )}
            {(serverErrors?.countryCode || serverErrors?.phoneNumber) && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {serverErrors.countryCode?.[0] || serverErrors.phoneNumber?.[0]}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="personalEmail" className="block text-sm text-neutral-800">Personal Email *</label>
            <input id="personalEmail" type="email" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("personalEmail")} aria-required="true" aria-invalid={!!errors.personalEmail || undefined} aria-describedby={errors.personalEmail ? "personalEmail-error" : undefined} />
            {errors.personalEmail && <p id="personalEmail-error" role="alert" className="mt-1 text-xs text-red-600">{errors.personalEmail.message}</p>}
            {serverErrors?.personalEmail && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.personalEmail[0]}</p>}
          </div>
          <div className="lg:col-span-3">
            <label htmlFor="password" className="block text-sm text-neutral-800">Password *</label>
            <input id="password" type="password" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("password")} aria-required="true" aria-invalid={!!errors.password || undefined} aria-describedby={errors.password ? "password-error" : undefined} />
            {errors.password && <p id="password-error" role="alert" className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            {serverErrors?.password && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.password[0]}</p>}
            {/* Strength meter */}
            <div className="mt-2 flex items-center gap-2" aria-live="polite" aria-atomic="true">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-2 w-10 rounded ${strength.score > i ? "bg-green-500" : "bg-neutral-300"}`} />
                ))}
              </div>
              <span className="text-xs text-neutral-600">Strength: {strength.score}/5</span>
            </div>
          </div>
        </div>
        {/* Step navigation */}
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={handleNext} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Next</button>
        </div>
      </section>

      {/* Address Information */}
      <section
        aria-labelledby="address-info-heading"
        className={`mb-6 ${step === 2 ? "animate-[fadeInUp_.3s_ease]" : "hidden"}`}
        aria-hidden={step !== 2}
      >
        <h2 id="address-info-heading" className="text-lg font-semibold text-neutral-800">Address Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label htmlFor="address" className="block text-sm text-neutral-700">Address</label>
            <textarea id="address" rows={3} className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("address")} aria-invalid={!!errors.address || undefined} aria-describedby={errors.address ? "address-error" : undefined} />
            {errors.address && <p id="address-error" role="alert" className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
            {serverErrors?.address && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.address[0]}</p>}
          </div>
          <div>
            <label htmlFor="province" className="block text-sm text-neutral-700">Province</label>
            <select id="province" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("province")} aria-invalid={!!errors.province || undefined} aria-describedby={errors.province ? "province-error" : undefined}>
              <option value="" disabled>Choose...</option>
              {provinces.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.province && <p id="province-error" role="alert" className="mt-1 text-xs text-red-600">{errors.province.message}</p>}
            {serverErrors?.province && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.province[0]}</p>}
          </div>
          <div>
            <label htmlFor="homeCity" className="block text-sm text-neutral-800">Home City *</label>
            <input id="homeCity" list="cities-list" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("homeCity")} aria-required="true" aria-invalid={!!errors.homeCity || undefined} aria-describedby={errors.homeCity ? "homeCity-error" : undefined} />
            <datalist id="cities-list">
              <option>Lahore</option>
              <option>Karachi</option>
              <option>Islamabad</option>
              <option>Multan</option>
              <option>Faisalabad</option>
              <option>Peshawar</option>
              <option>Quetta</option>
              <option>Rawalpindi</option>
            </datalist>
            {errors.homeCity && <p id="homeCity-error" role="alert" className="mt-1 text-xs text-red-600">{errors.homeCity.message}</p>}
            {serverErrors?.homeCity && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.homeCity[0]}</p>}
          </div>
          <div>
            <label htmlFor="homeCountry" className="block text-sm text-neutral-800">Home Country</label>
            <select id="homeCountry" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="Pakistan" {...register("homeCountry")} aria-invalid={!!errors.homeCountry || undefined} aria-describedby={errors.homeCountry ? "homeCountry-error" : undefined}>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.homeCountry && <p id="homeCountry-error" role="alert" className="mt-1 text-xs text-red-600">{errors.homeCountry.message}</p>}
            {serverErrors?.homeCountry && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.homeCountry[0]}</p>}
          </div>
        </div>
        {/* Step navigation */}
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={handlePrev} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">Back</button>
          <button type="button" onClick={handleNext} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Next</button>
        </div>
      </section>

      {/* Academic Information */}
      <section
        aria-labelledby="academic-info-heading"
        className={`mb-6 ${step === 3 ? "animate-[fadeInUp_.3s_ease]" : "hidden"}`}
        aria-hidden={step !== 3}
      >
        <h2 id="academic-info-heading" className="text-lg font-semibold text-neutral-800">Academic Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="campus" className="block text-sm text-neutral-800">Campus *</label>
            <select id="campus" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("campus")} aria-required="true" aria-invalid={!!errors.campus || undefined} aria-describedby={errors.campus ? "campus-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Main Campus</option>
              <option>City Campus</option>
            </select>
            {errors.campus && <p id="campus-error" role="alert" className="mt-1 text-xs text-red-600">{errors.campus.message}</p>}
            {serverErrors?.campus && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.campus[0]}</p>}
          </div>
          <div>
            <label htmlFor="faculty" className="block text-sm text-neutral-800">Faculty *</label>
            <select id="faculty" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("faculty")} aria-required="true" aria-invalid={!!errors.faculty || undefined} aria-describedby={errors.faculty ? "faculty-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Engineering</option>
              <option>Business</option>
              <option>Computer Science</option>
            </select>
            {errors.faculty && <p id="faculty-error" role="alert" className="mt-1 text-xs text-red-600">{errors.faculty.message}</p>}
            {serverErrors?.faculty && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.faculty[0]}</p>}
          </div>
          <div>
            <label htmlFor="department" className="block text-sm text-neutral-800">Department *</label>
            <input id="department" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("department")} aria-required="true" aria-invalid={!!errors.department || undefined} aria-describedby={errors.department ? "department-error" : undefined} />
            {errors.department && <p id="department-error" role="alert" className="mt-1 text-xs text-red-600">{errors.department.message}</p>}
            {serverErrors?.department && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.department[0]}</p>}
          </div>
          <div>
            <label htmlFor="program" className="block text-sm text-neutral-800">Program *</label>
            <input id="program" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("program")} aria-required="true" aria-invalid={!!errors.program || undefined} aria-describedby={errors.program ? "program-error" : undefined} />
            {errors.program && <p id="program-error" role="alert" className="mt-1 text-xs text-red-600">{errors.program.message}</p>}
            {serverErrors?.program && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.program[0]}</p>}
          </div>
          <div>
            <label htmlFor="passingYear" className="block text-sm text-neutral-800">Year of Passing Out *</label>
            <input id="passingYear" type="number" min="1900" max={new Date().getFullYear()} className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("passingYear")} aria-required="true" aria-invalid={!!errors.passingYear || undefined} aria-describedby={errors.passingYear ? "passingYear-error" : undefined} />
            {errors.passingYear && <p id="passingYear-error" role="alert" className="mt-1 text-xs text-red-600">{errors.passingYear.message}</p>}
            {serverErrors?.passingYear && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.passingYear[0]}</p>}
          </div>
        </div>
      </section>

      {/* Work Information */}
      <section
        aria-labelledby="work-info-heading"
        className={`mb-6 ${step === 3 ? "animate-[fadeInUp_.3s_ease]" : "hidden"}`}
        aria-hidden={step !== 3}
      >
        <h2 id="work-info-heading" className="text-lg font-semibold text-neutral-800">Work Information</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="employmentStatus" className="block text-sm text-neutral-700">Employment Status</label>
            <select id="employmentStatus" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("employmentStatus")} aria-invalid={!!errors.employmentStatus || undefined} aria-describedby={errors.employmentStatus ? "employmentStatus-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Employed</option>
              <option>Unemployed</option>
            </select>
            {errors.employmentStatus && <p id="employmentStatus-error" role="alert" className="mt-1 text-xs text-red-600">{errors.employmentStatus.message}</p>}
            {serverErrors?.employmentStatus && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.employmentStatus[0]}</p>}
          </div>
          <div>
            <label htmlFor="sector" className="block text-sm text-neutral-800">Sector *</label>
            <select id="sector" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("sector")} aria-required="true" aria-invalid={!!errors.sector || undefined} aria-describedby={errors.sector ? "sector-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Private</option>
              <option>Public</option>
              <option>NGO</option>
            </select>
            {errors.sector && <p id="sector-error" role="alert" className="mt-1 text-xs text-red-600">{errors.sector.message}</p>}
            {serverErrors?.sector && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.sector[0]}</p>}
          </div>
          <div>
            <label htmlFor="subSector" className="block text-sm text-neutral-800">Sub Sector *</label>
            <input id="subSector" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("subSector")} aria-required="true" aria-invalid={!!errors.subSector || undefined} aria-describedby={errors.subSector ? "subSector-error" : undefined} />
            {errors.subSector && <p id="subSector-error" role="alert" className="mt-1 text-xs text-red-600">{errors.subSector.message}</p>}
            {serverErrors?.subSector && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.subSector[0]}</p>}
          </div>
          <div>
            <label htmlFor="organization" className="block text-sm text-neutral-800">Name of Organization *</label>
            <input id="organization" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("organization")} aria-required="true" aria-invalid={!!errors.organization || undefined} aria-describedby={errors.organization ? "organization-error" : undefined} />
            {errors.organization && <p id="organization-error" role="alert" className="mt-1 text-xs text-red-600">{errors.organization.message}</p>}
            {serverErrors?.organization && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.organization[0]}</p>}
          </div>
          <div>
            <label htmlFor="designation" className="block text-sm text-neutral-800">Designation *</label>
            <input id="designation" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("designation")} aria-required="true" aria-invalid={!!errors.designation || undefined} aria-describedby={errors.designation ? "designation-error" : undefined} />
            {errors.designation && <p id="designation-error" role="alert" className="mt-1 text-xs text-red-600">{errors.designation.message}</p>}
            {serverErrors?.designation && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.designation[0]}</p>}
          </div>
          <div>
            <label htmlFor="totalExperienceYears" className="block text-sm text-neutral-800">Total Experience *</label>
            <input id="totalExperienceYears" type="number" min="0" step="0.1" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("totalExperienceYears")} aria-required="true" aria-invalid={!!errors.totalExperienceYears || undefined} aria-describedby={errors.totalExperienceYears ? "totalExperienceYears-error" : undefined} />
            {errors.totalExperienceYears && <p id="totalExperienceYears-error" role="alert" className="mt-1 text-xs text-red-600">{errors.totalExperienceYears.message}</p>}
            {serverErrors?.totalExperienceYears && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.totalExperienceYears[0]}</p>}
          </div>
          <div>
            <label htmlFor="officialEmail" className="block text-sm text-neutral-700">Official Email</label>
            <input id="officialEmail" type="email" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("officialEmail")} aria-invalid={!!errors.officialEmail || undefined} aria-describedby={errors.officialEmail ? "officialEmail-error" : undefined} />
            {errors.officialEmail && <p id="officialEmail-error" role="alert" className="mt-1 text-xs text-red-600">{errors.officialEmail.message}</p>}
            {serverErrors?.officialEmail && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.officialEmail[0]}</p>}
          </div>
          <div>
            <label htmlFor="officialPhone" className="block text-sm text-neutral-700">Official Phone #</label>
            <input id="officialPhone" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("officialPhone")} aria-invalid={!!errors.officialPhone || undefined} aria-describedby={errors.officialPhone ? "officialPhone-error" : undefined} />
            {errors.officialPhone && <p id="officialPhone-error" role="alert" className="mt-1 text-xs text-red-600">{errors.officialPhone.message}</p>}
            {serverErrors?.officialPhone && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.officialPhone[0]}</p>}
          </div>
          <div>
            <label htmlFor="workCity" className="block text-sm text-neutral-800">Work City *</label>
            <input id="workCity" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("workCity")} aria-required="true" aria-invalid={!!errors.workCity || undefined} aria-describedby={errors.workCity ? "workCity-error" : undefined} />
            {errors.workCity && <p id="workCity-error" role="alert" className="mt-1 text-xs text-red-600">{errors.workCity.message}</p>}
            {serverErrors?.workCity && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.workCity[0]}</p>}
          </div>
          <div>
            <label htmlFor="workCountry" className="block text-sm text-neutral-800">Work Country *</label>
            <select id="workCountry" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("workCountry")} aria-required="true" aria-invalid={!!errors.workCountry || undefined} aria-describedby={errors.workCountry ? "workCountry-error" : undefined}>
              <option value="" disabled>Choose...</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.workCountry && <p id="workCountry-error" role="alert" className="mt-1 text-xs text-red-600">{errors.workCountry.message}</p>}
            {serverErrors?.workCountry && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.workCountry[0]}</p>}
          </div>
        </div>
      </section>

      {/* Admin Section */}
      <section
        aria-labelledby="admin-heading"
        className={`mb-6 ${step === 3 ? "animate-[fadeInUp_.3s_ease]" : "hidden"}`}
        aria-hidden={step !== 3}
      >
        <h2 id="admin-heading" className="text-lg font-semibold text-neutral-800">Admin Section</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="source" className="block text-sm text-neutral-700">Source</label>
            <input id="source" type="text" className="mt-1 w-full rounded border border-neutral-300 p-2" {...register("source")} aria-invalid={!!errors.source || undefined} aria-describedby={errors.source ? "source-error" : undefined} />
            {errors.source && <p id="source-error" role="alert" className="mt-1 text-xs text-red-600">{errors.source.message}</p>}
            {serverErrors?.source && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.source[0]}</p>}
          </div>
          <div>
            <label htmlFor="verified" className="block text-sm text-neutral-800">Verified</label>
            <input id="verified" type="checkbox" className="mt-1 h-4 w-4 rounded border border-neutral-300" {...register("verified")} aria-invalid={!!errors.verified || undefined} aria-describedby={errors.verified ? "verified-error" : undefined} />
            {errors.verified && <p id="verified-error" role="alert" className="mt-1 text-xs text-red-600">{errors.verified.message}</p>}
          </div>
          <div>
            <label htmlFor="category" className="block text-sm text-neutral-800">Alumni Category</label>
            <select id="category" className="mt-1 w-full rounded border border-neutral-300 p-2" defaultValue="" {...register("category")} aria-invalid={!!errors.category || undefined} aria-describedby={errors.category ? "category-error" : undefined}>
              <option value="" disabled>Choose...</option>
              <option>Gold</option>
              <option>Silver</option>
              <option>Bronze</option>
            </select>
            {errors.category && <p id="category-error" role="alert" className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
            {serverErrors?.category && <p role="alert" className="mt-1 text-xs text-red-600">{serverErrors.category[0]}</p>}
          </div>
        </div>
        {/* Step navigation + Submit */}
        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={handlePrev} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">Back</button>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50" disabled={submitting} aria-busy={submitting} aria-disabled={submitting}>
            {editingSapId ? (submitting ? "Updating..." : "Update") : (submitting ? "Submitting..." : "Submit")}
          </button>
          {submitMsg && <span role="status" className="text-sm text-neutral-700">{submitMsg}</span>}
        </div>
      </section>

      {/* Step error feedback */}
      {stepError && (
        <p role="alert" className="mt-4 text-sm text-red-600" aria-live="polite">{stepError}</p>
      )}

      {/* Subtle animation keyframes */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </form>
  );
};