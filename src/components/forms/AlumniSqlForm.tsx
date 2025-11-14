"use client";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

// TypeScript type reflecting public.tbl_alumni schema (excluding serial primary key)
export type TblAlumniForm = {
  alumniemail: string | null;
  password: string | null;
  todaydate: string | null; // ISO datetime-local string
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
  emailsendcount: number | null; // smallint
  emailsendstatus: string | null;
  createddatetime: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  linkedin: string | null;
  datasource: string | null;
  alumnistatus: string | null;
};

const inputBase = "mt-1 w-full rounded border border-neutral-300 p-2";
const labelBase = "block text-sm text-neutral-800";

export default function AlumniSqlForm() {
  const {
    register,
    handleSubmit,
    reset,
    trigger,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<TblAlumniForm>({
    defaultValues: {
      alumniemail: null,
      password: null,
      todaydate: null,
      registrationno: null,
      sapid: null,
      alumniname: null,
      gender: null,
      fathername: null,
      dateofbirth: null,
      maritalstatus: null,
      cnicpassport: null,
      contactno: null,
      contactno1: null,
      contactno1show: null,
      personalemail: null,
      personalemailshow: null,
      universityemail: null,
      country: "Pakistan",
      province: null,
      city: null,
      address: null,
      academicsession: null,
      degreetitle: null,
      cgpa: null,
      yearofstarting: null,
      yearofending: null,
      facultyname: null,
      campusname: null,
      departmentname: null,
      majorsubject: null,
      industry: null,
      employeed: "Unemployed",
      nameoforganization: null,
      designation: null,
      totalyearsofexpereince: null,
      officialemail: null,
      officialnumber: null,
      supervisorname: null,
      supervisordesignation: null,
      supervisoremail: null,
      supervisornumber: null,
      image1: null,
      cv: null,
      aboutme: null,
      lasttimelogin: null,
      logincount: null,
      verify: "No",
      emailsendcount: null,
      emailsendstatus: null,
      createddatetime: null,
      facebook: null,
      instagram: null,
      youtube: null,
      linkedin: null,
      datasource: null,
      alumnistatus: null,
    },
  });

  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordVal = watch("password") || "";
  const contactVal = watch("contactno") || "";
  const personalEmailVal = watch("personalemail") || "";
  const employeedVal = (watch("employeed") || "Unemployed") as string;

  const passwordScore = useMemo(() => {
    let score = 0;
    if (passwordVal.length >= 8) score++;
    if (/[A-Z]/.test(passwordVal)) score++;
    if (/[a-z]/.test(passwordVal)) score++;
    if (/\d/.test(passwordVal)) score++;
    if (/[^A-Za-z0-9]/.test(passwordVal)) score++;
    return score; // 0-5
  }, [passwordVal]);

  const phonePattern = /^\+?[1-9]\d{7,14}$/; // E.164-ish
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function validateStep(current: number) {
    clearErrors();
    if (current === 1) {
      const ok = await trigger([
        "sapid",
        "alumniname",
        "gender",
        "contactno",
        "personalemail",
        "password",
        "city",
        "country",
      ]);
      if (!ok) return false;
      if (!phonePattern.test(contactVal)) {
        setError("contactno", { type: "pattern", message: "Must be international format e.g. +923001234567" });
        return false;
      }
      if (!emailPattern.test(personalEmailVal)) {
        setError("personalemail", { type: "pattern", message: "Invalid email format" });
        return false;
      }
      if (passwordScore < 4) {
        setError("password", { type: "min", message: "Password too weak (use upper, lower, number, symbol)" });
        return false;
      }
      return true;
    }
    if (current === 2) {
      const ok = await trigger([
        "campusname",
        "facultyname",
        "departmentname",
        "degreetitle",
        "yearofending",
      ]);
      return ok;
    }
    if (current === 3) {
      const baseOk = await trigger([
        "employeed",
        "industry",
        "nameoforganization",
        "designation",
        "totalyearsofexpereince",
        "city",
        "country",
      ]);
      if (!baseOk) return false;
      // Conditional: when employed, industry/org/designation/experience required
      if ((employeedVal || "").toLowerCase() === "employed") {
        const fields: Array<keyof TblAlumniForm> = [
          "industry",
          "nameoforganization",
          "designation",
          "totalyearsofexpereince",
        ];
        for (const f of fields) {
          const val = watch(f);
          if (!val || String(val).trim() === "") {
            setError(f, { type: "required", message: "Required" });
            return false;
          }
        }
      }
      return true;
    }
    if (current === 4) {
      const ok = await trigger(["datasource", "verify", "alumnistatus"]);
      return ok;
    }
    return true;
  }

  async function onSubmit(data: TblAlumniForm) {
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitError(null);
    try {
      const payload: TblAlumniForm = { ...data };
      if (!payload.alumniemail || String(payload.alumniemail).trim() === "") {
        payload.alumniemail = payload.personalemail ?? null;
      }
      if (!payload.datasource || String(payload.datasource).trim() === "") {
        payload.datasource = "Alumni";
      }
      // Send to API (server will sanitize and validate again)
      const res = await fetch("/api/alumni/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save record");
      }
      setSubmitMsg(`Saved. New Alumni ID: ${json.alumniid}`);
      reset();
      setStep(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  function nextStep() {
    validateStep(step).then((ok) => {
      if (ok) setStep((s) => Math.min(4, s + 1));
    });
  }

  function prevStep() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 bg-white px-4" aria-label="Alumni registration form">
      <input type="hidden" value="Alumni" {...register("datasource")} />
      <input type="hidden" name="alumni" value="alumni" />
      {/* Notifications */}
      {(submitMsg || submitError || submitting) && (
        <div className="mb-4" aria-live="polite" aria-atomic="true">
          {submitting && <div className="text-sm text-neutral-600">Submitting...</div>}
          {submitMsg && <div role="status" className="text-sm text-green-700">{submitMsg}</div>}
          {submitError && <div role="alert" className="text-sm text-red-700">{submitError}</div>}
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {[1,2,3,4].map((n) => (
            <div key={n} className="flex-1">
              <div className={`h-2 rounded ${step >= n ? "bg-indigo-600" : "bg-neutral-200"}`}></div>
              <p className="mt-2 text-center text-xs text-neutral-700">
                {n === 1 && "Personal Information"}
                {n === 2 && "Academic Information"}
                {n === 3 && "Work Status"}
                {n === 4 && "Admin Section"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Personal Information</h2>
          <p className="mt-1 text-xs text-neutral-600">Fields marked with * are required.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>Registration #</label>
              <input type="text" className={inputBase} {...register("registrationno", { maxLength: 20 })} />
            </div>
            <div>
              <label className={labelBase}>SAP ID *</label>
              <input type="text" className={inputBase} {...register("sapid", { required: true, maxLength: 20 })} />
              {errors.sapid && <p className="mt-1 text-xs text-red-600">SAP ID is required</p>}
            </div>
            <div>
              <label className={labelBase}>Name *</label>
              <input type="text" className={inputBase} {...register("alumniname", { required: true, maxLength: 200 })} />
              {errors.alumniname && <p className="mt-1 text-xs text-red-600">Name is required</p>}
            </div>
            <div>
              <label className={labelBase}>Father Name</label>
              <input type="text" className={inputBase} {...register("fathername", { maxLength: 200 })} />
            </div>
            <div>
              <label className={labelBase}>Gender *</label>
              <select className={inputBase} {...register("gender", { required: true })}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && <p className="mt-1 text-xs text-red-600">Gender is required</p>}
            </div>
            <div>
              <label className={labelBase}>Date of Birth</label>
              <input type="date" className={inputBase} {...register("dateofbirth", { maxLength: 50 })} />
            </div>
            <div>
              <label className={labelBase}>Marital Status</label>
              <select className={inputBase} {...register("maritalstatus")}> 
                <option value="">Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
            <div>
              <label className={labelBase}>CNIC/Passport#</label>
              <input type="text" className={inputBase} {...register("cnicpassport", { maxLength: 50 })} />
            </div>
            <div>
              <label className={labelBase}>Mobile No.*</label>
              <input type="tel" className={inputBase} placeholder="e.g. +923001234567" {...register("contactno", { required: true, maxLength: 50 })} />
              {errors.contactno && <p className="mt-1 text-xs text-red-600">Valid phone is required</p>}
            </div>
            <div>
              <label className={labelBase}>Personal Email *</label>
              <input type="email" className={inputBase} {...register("personalemail", { required: true, maxLength: 100 })} />
              {errors.personalemail && <p className="mt-1 text-xs text-red-600">Valid email is required</p>}
            </div>
            <div className="lg:col-span-1">
              <label className={labelBase}>Password *</label>
              <input type="password" className={inputBase} {...register("password", { required: true, maxLength: 50 })} />
              <div className="mt-2 h-2 rounded bg-neutral-200">
                <div className={`h-2 rounded ${passwordScore <= 2 ? "bg-red-500" : passwordScore === 3 ? "bg-yellow-500" : "bg-green-600"}`} style={{ width: `${(passwordScore/5)*100}%` }}></div>
              </div>
              <p className="mt-1 text-xs text-neutral-600">Use upper + lower + number + symbol, min 8 chars.</p>
              {errors.password && <p className="mt-1 text-xs text-red-600">{String(errors.password.message || "Password is required")}</p>}
            </div>
            <div className="lg:col-span-3">
              <label className={labelBase}>Address</label>
              <textarea rows={3} className={inputBase} {...register("address", { maxLength: 250 })} />
            </div>
            <div>
              <label className={labelBase}>Province</label>
              <select className={inputBase} {...register("province")}> 
                <option value="">Select</option>
                <option value="Punjab">Punjab</option>
                <option value="Sindh">Sindh</option>
                <option value="KPK">KPK</option>
                <option value="Balochistan">Balochistan</option>
                <option value="Islamabad">Islamabad Capital Territory</option>
                <option value="GB">Gilgit-Baltistan</option>
                <option value="AJK">Azad Kashmir</option>
              </select>
            </div>
            <div>
              <label className={labelBase}>Home City *</label>
              <input type="text" className={inputBase} {...register("city", { required: true, maxLength: 50 })} />
              {errors.city && <p className="mt-1 text-xs text-red-600">City is required</p>}
            </div>
            <div>
              <label className={labelBase}>Home Country *</label>
              <select className={inputBase} {...register("country", { required: true })}>
                <option value="">Select</option>
                <option value="Pakistan">Pakistan</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Other">Other</option>
              </select>
              {errors.country && <p className="mt-1 text-xs text-red-600">Country is required</p>}
            </div>
          </div>
        </section>
      )}

      {/* Step 2: Academic Information */}
      {step === 2 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Academic Information</h2>
          <p className="mt-1 text-xs text-neutral-600">All fields are required.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>Campus *</label>
              <select className={inputBase} {...register("campusname", { required: true })}>
                <option value="">Select</option>
                <option value="Main">Main Campus</option>
                <option value="City">City Campus</option>
                <option value="Sub">Sub Campus</option>
              </select>
              {errors.campusname && <p className="mt-1 text-xs text-red-600">Campus is required</p>}
            </div>
            <div>
              <label className={labelBase}>Faculty *</label>
              <select className={inputBase} {...register("facultyname", { required: true })}>
                <option value="">Select</option>
                <option value="Business">Business</option>
                <option value="Science & Technology">Science & Technology</option>
                <option value="Arts & Humanities">Arts & Humanities</option>
              </select>
              {errors.facultyname && <p className="mt-1 text-xs text-red-600">Faculty is required</p>}
            </div>
            <div>
              <label className={labelBase}>Department *</label>
              <select className={inputBase} {...register("departmentname", { required: true })}>
                <option value="">Select</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Management">Management</option>
              </select>
              {errors.departmentname && <p className="mt-1 text-xs text-red-600">Department is required</p>}
            </div>
            <div>
              <label className={labelBase}>Program *</label>
              <select className={inputBase} {...register("degreetitle", { required: true })}>
                <option value="">Select</option>
                <option value="BS Computer Science">BS Computer Science</option>
                <option value="BBA">BBA</option>
                <option value="MBA">MBA</option>
                <option value="MS Computer Science">MS Computer Science</option>
              </select>
              {errors.degreetitle && <p className="mt-1 text-xs text-red-600">Program is required</p>}
            </div>
            <div>
              <label className={labelBase}>Year of Passing Out *</label>
              <input type="number" className={inputBase} {...register("yearofending", { required: true, valueAsNumber: true })} />
              {errors.yearofending && <p className="mt-1 text-xs text-red-600">Year is required</p>}
            </div>
          </div>
        </section>
      )}

      {/* Step 3: Work Status */}
      {step === 3 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Work Status</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelBase}>Current Status</label>
              <div className="mt-2 flex gap-6">
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Employed" {...register("employeed")} /> Employed
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-800">
                  <input type="radio" value="Unemployed" {...register("employeed")} /> Unemployed
                </label>
              </div>
            </div>

            {/* Sector = industry */}
            <div>
              <label className={labelBase}>Sector *</label>
              <input type="text" className={inputBase} {...register("industry", { required: (employeedVal || "").toLowerCase() === "employed", maxLength: 100 })} />
              {(errors.industry && (employeedVal || "").toLowerCase() === "employed") && (
                <p className="mt-1 text-xs text-red-600">Sector is required</p>
              )}
              <p className="mt-1 text-xs text-neutral-600">Maps to `industry` per schema.</p>
            </div>

            {/* Name of Organization */}
            <div>
              <label className={labelBase}>Name of Organization *</label>
              <input type="text" className={inputBase} {...register("nameoforganization", { required: (employeedVal || "").toLowerCase() === "employed", maxLength: 100 })} />
              {(errors.nameoforganization && (employeedVal || "").toLowerCase() === "employed") && (
                <p className="mt-1 text-xs text-red-600">Organization is required</p>
              )}
            </div>

            {/* Designation */}
            <div>
              <label className={labelBase}>Designation *</label>
              <input type="text" className={inputBase} {...register("designation", { required: (employeedVal || "").toLowerCase() === "employed", maxLength: 100 })} />
              {(errors.designation && (employeedVal || "").toLowerCase() === "employed") && (
                <p className="mt-1 text-xs text-red-600">Designation is required</p>
              )}
            </div>

            {/* Total Experience */}
            <div>
              <label className={labelBase}>Total Experience *</label>
              <input type="text" className={inputBase} placeholder="e.g. 3" {...register("totalyearsofexpereince", { required: (employeedVal || "").toLowerCase() === "employed", maxLength: 10 })} />
              {(errors.totalyearsofexpereince && (employeedVal || "").toLowerCase() === "employed") && (
                <p className="mt-1 text-xs text-red-600">Experience is required</p>
              )}
            </div>

            {/* Official Email */}
            <div>
              <label className={labelBase}>Official Email (optional)</label>
              <input type="email" className={inputBase} {...register("officialemail", { maxLength: 100 })} />
            </div>

            {/* Official Phone */}
            <div>
              <label className={labelBase}>Official Phone # (optional)</label>
              <input type="text" className={inputBase} {...register("officialnumber", { maxLength: 50 })} />
            </div>

            {/* Work City/Country bound to same schema fields */}
            <div>
              <label className={labelBase}>Work City *</label>
              <input type="text" className={inputBase} {...register("city", { required: true, maxLength: 50 })} />
              {errors.city && <p className="mt-1 text-xs text-red-600">Work city is required</p>}
              <p className="mt-1 text-xs text-neutral-600">Overrides Home City and maps to `city`.</p>
            </div>
            <div>
              <label className={labelBase}>Work Country *</label>
              <select className={inputBase} {...register("country", { required: true })}>
                <option value="">Select</option>
                <option value="Pakistan">Pakistan</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Other">Other</option>
              </select>
              {errors.country && <p className="mt-1 text-xs text-red-600">Work country is required</p>}
              <p className="mt-1 text-xs text-neutral-600">Overrides Home Country and maps to `country`.</p>
            </div>
          </div>
        </section>
      )}

      {/* Step 4: Admin Section */}
      {step === 4 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Admin Section</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelBase}>Source</label>
              <select className={inputBase} {...register("datasource")}> 
                <option value="">Select</option>
                <option value="Website">Website</option>
                <option value="Form">Form</option>
                <option value="Import">Import</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" {...register("verify")} />
              <label className={labelBase}>Verify</label>
              <p className="ml-2 text-xs text-neutral-600">Stored as a string flag on server (Yes/No).</p>
            </div>
            <div>
              <label className={labelBase}>Alumni Category</label>
              <select className={inputBase} {...register("alumnistatus")}> 
                <option value="">Select</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step > 1 && (
          <button type="button" onClick={prevStep} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50">Back</button>
        )}
        {step < 4 && (
          <button type="button" onClick={nextStep} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Next</button>
        )}
        {step === 4 && (
          <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60">Submit</button>
        )}
        <button type="button" disabled={submitting} onClick={() => { reset(); setStep(1); }} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50">Reset</button>
      </div>
    </form>
  );
}