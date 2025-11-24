"use client";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type MeAlumni = {
  sapid: string;
  alumniname: string;
  facultyname: string | null;
  degreetitle: string | null;
  departmentname: string | null;
  personalemail: string | null;
  officialemail: string | null;
  universityemail?: string | null;
};

type MentorshipFormValues = {
  major: string;
  area: number;
  topic: string;
  day: string;
  start: string;
  end: string;
};

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

function useCurrentAlumni(email: string | undefined) {
  return useQuery({
    queryKey: ["alumni", "me", email ?? ""],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/alumni", { signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items: MeAlumni[] };
      const items = data.items || [];
      const e = String(email || "").toLowerCase();
      const match = items.find((it) => {
        const p = String(it.personalemail || "").toLowerCase();
        const o = String(it.officialemail || "").toLowerCase();
        const u = String(it.universityemail || "").toLowerCase();
        return e && (p === e || o === e || u === e);
      });
      return match as MeAlumni | undefined;
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
  });
}

export default function MentorshipForm() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const { data: me } = useCurrentAlumni(email ?? undefined);
  const qc = useQueryClient();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    formState,
    trigger,
  } = useForm<MentorshipFormValues>({
    defaultValues: { major: "", area: undefined as unknown as number, topic: "", day: "", start: "", end: "" },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const major = watch("major");
  const topic = watch("topic");
  const day = watch("day");
  const area = watch("area");
  const start = watch("start");
  const end = watch("end");

  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    // Check all required fields have values
    const hasMajor = !!String(major || "").trim();
    const hasArea = typeof area === 'number' && !isNaN(area) && area > 0;
    const hasTopic = !!String(topic || "").trim();
    const validDay = WEEKDAYS.includes(String(day || "") as typeof WEEKDAYS[number]);
    const hasStartTime = !!String(start || "").trim();
    const hasEndTime = !!String(end || "").trim();
    
    // Basic validation - all fields filled
    const allFieldsFilled = hasMajor && hasArea && hasTopic && validDay && hasStartTime && hasEndTime;
    
    // Additional time validation - end must be after start
    let timeValid = true;
    if (hasStartTime && hasEndTime) {
      const t1 = String(start || "").trim();
      const t2 = String(end || "").trim();
      // Simple string comparison works for HH:MM format
      if (t1 && t2) {
        timeValid = t1 < t2;
      }
    }
    
    return allFieldsFilled && timeValid;
  }, [major, area, topic, day, start, end]);

  const errors = formState.errors;

  async function onSubmit(values: MentorshipFormValues) {
    try {
      setSubmitting(true);
      const loadingToast = toast.loading("Submitting your mentorship application...");
      
      const payload = {
        major: String(values.major || "").trim(),
        areas: [String(values.area || "")].filter(Boolean),
        topics: [String(values.topic || "").trim()].filter(Boolean),
        day: String(values.day || "").trim(),
        time: `${String(values.start || "").trim()}-${String(values.end || "").trim()}`,
      };
      const res = await fetch("/api/alumni/talks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      toast.dismiss(loadingToast);
      
      if (!res.ok) {
        let errorMsg = data?.error || data?.message || "Failed to submit application. Please try again.";
        
        // Provide user-friendly error messages
        if (data?.error === "ALUMNI_NOT_FOUND") {
          errorMsg = data?.message || "Your alumni record was not found. Please ensure you are logged in with the correct account.";
        } else if (data?.error === "UNAUTHENTICATED") {
          errorMsg = "You must be logged in to submit an application. Please sign in and try again.";
        }
        
        toast.error(errorMsg, {
          duration: 6000,
          style: {
            background: '#fee2e2',
            color: '#991b1b',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        throw new Error(errorMsg);
      }
      
      toast.success("Mentorship application submitted successfully!", {
        duration: 4000,
        style: {
          background: '#d1fae5',
          color: '#065f46',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      
      qc.invalidateQueries({ queryKey: ["alumni", "participation", "list"] });
      resetField("topic");
      resetField("area");
      
      // Navigate back to profile page
      setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sapId = urlParams.get('sapid') || me?.sapid;
        if (sapId) {
          router.push(`/alumni-profile?sapid=${encodeURIComponent(sapId)}`);
        } else {
          router.push('/alumni-profile');
        }
        router.refresh();
      }, 1500);
    } catch {
      // Error already handled with toast above
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl max-w-4xl mx-auto border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Mentorship Program</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">Provide details to participate in mentorship sessions.</p>

      <form className="max-w-4xl mx-auto mt-4" onSubmit={async (e) => { e.preventDefault(); const ok = await trigger(); if (ok) handleSubmit(onSubmit)(); }}>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className={labelBase}>Major/Specialization</label>
            <div className="relative flex items-center">
              <input className={`${inputBase} ${errors.major ? "border-rose-500 bg-rose-50" : ""}`} placeholder="e.g., Data Science" {...register("major", { required: "Major is required" })} />
            </div>
            {errors.major && <span className={errorText}>{String(errors.major.message || "Required")}</span>}
          </div>

          <div>
            <label className={labelBase}>Area of Experience (Years)</label>
            <div className="relative flex items-center">
              <input 
                type="number" 
                min="1"
                step="1"
                className={`${inputBase} ${errors.area ? "border-rose-500 bg-rose-50" : ""}`} 
                placeholder="e.g., 5" 
                {...register("area", { 
                  required: "Area of experience is required",
                  valueAsNumber: true,
                  min: {
                    value: 1,
                    message: "Please enter a number greater than 0"
                  },
                  validate: (value) => {
                    const num = Number(value);
                    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
                      return "Please enter a valid whole number greater than 0";
                    }
                    return true;
                  }
                })} 
              />
            </div>
            {errors.area && <span className={errorText}>{String(errors.area.message || "Required")}</span>}
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Topic for mentoring</label>
            <div className="relative flex items-center">
              <input className={`${inputBase} ${errors.topic ? "border-rose-500 bg-rose-50" : ""}`} placeholder="e.g., React Performance" {...register("topic", { required: "Topic is required" })} />
            </div>
            {errors.topic && <span className={errorText}>{String(errors.topic.message || "Required")}</span>}
          </div>

          <div>
            <label className={labelBase}>Availability (Weekday)</label>
            <div className="relative flex items-center">
              <select className={`${inputBase} ${errors.day ? "border-rose-500 bg-rose-50" : ""}`} {...register("day", { required: "Weekday is required", validate: (v) => WEEKDAYS.includes(v as typeof WEEKDAYS[number]) || "Weekday must be Monday to Friday" })}>
                <option value="">Select a day</option>
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {errors.day && <span className={errorText}>{String(errors.day.message || "Required")}</span>}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelBase}>Start</label>
              <div className="relative flex items-center">
                <input type="time" className={`${inputBase} ${errors.start ? "border-rose-500 bg-rose-50" : ""}`} {...register("start", { required: "Start time is required", validate: (v) => (/^\d{2}:\d{2}$/.test(String(v)) || "Invalid time format") })} />
              </div>
              {errors.start && <span className={errorText}>{String(errors.start.message || "Required")}</span>}
            </div>
            <div>
              <label className={labelBase}>End</label>
              <div className="relative flex items-center">
                <input type="time" className={`${inputBase} ${errors.end ? "border-rose-500 bg-rose-50" : ""}`} {...register("end", { required: "End time is required", validate: (v) => {
                  const s = String(watch("start") || "");
                  const e = String(v || "");
                  if (!/^\d{2}:\d{2}$/.test(e)) return "Invalid time format";
                  if (!/^\d{2}:\d{2}$/.test(s)) return true;
                  return s < e || "End must be after start";
                } })} />
              </div>
              {errors.end && <span className={errorText}>{String(errors.end.message || "Required")}</span>}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <button 
            type="submit" 
            disabled={!canSubmit || submitting} 
            className="mt-12 px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title={!canSubmit ? "Please fill in all required fields correctly" : ""}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      

    </form>
    </div>
  );
}