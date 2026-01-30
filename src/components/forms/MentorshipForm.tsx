"use client";
import React, { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { alumniTalksKey } from "@/app/queries/fetch-alumni-talks";

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

type AvailabilityDate = {
  date: string;
  startTime: string;
  endTime: string;
};

type MentorshipFormValues = {
  major: string;
  area: number;
  topic: string;
  mode: "Online" | "Face to Face";
  briefOutline: string;
  availability: AvailabilityDate[];
  confirmed: boolean;
};

const inputBase = "px-4 py-3 pr-8 bg-[#f0f1f2] focus:bg-transparent text-black w-full text-sm border border-gray-200 outline-[#007bff] rounded-md transition-all";
const labelBase = "mb-2 text-sm text-slate-900 font-medium block";
const errorText = "mt-1 text-xs text-rose-600";

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

type MentorshipFormProps = {
  redirectOnSuccess?: boolean;
  onSubmitted?: () => void;
};

export default function MentorshipForm({ redirectOnSuccess = true, onSubmitted }: MentorshipFormProps) {
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
    control,
  } = useForm<MentorshipFormValues>({
    defaultValues: { 
      major: "", 
      area: undefined as unknown as number, 
      topic: "", 
      mode: "Online" as const,
      briefOutline: "",
      availability: [
        { date: "", startTime: "", endTime: "" },
      ],
      confirmed: false,
    },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "availability",
  });

  const major = watch("major");
  const topic = watch("topic");
  const area = watch("area");
  const mode = watch("mode");
  const briefOutline = watch("briefOutline");
  const availability = watch("availability");
  const confirmed = watch("confirmed");

  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    // Check all required fields have values
    const hasMajor = !!String(major || "").trim();
    const hasArea = typeof area === 'number' && !isNaN(area) && area > 0;
    const hasTopic = !!String(topic || "").trim();
    const hasMode = mode === "Online" || mode === "Face to Face";
    const hasBriefOutline = !!String(briefOutline || "").trim();
    
    // Check availability - at least 3 dates with valid date and times
    const validAvailability = availability.filter((avail) => {
      const hasDate = !!String(avail.date || "").trim();
      const hasStartTime = !!String(avail.startTime || "").trim();
      const hasEndTime = !!String(avail.endTime || "").trim();
      if (!hasDate || !hasStartTime || !hasEndTime) return false;
      // Validate time order
      return avail.startTime < avail.endTime;
    });
    
    const hasMinAvailability = validAvailability.length >= 3;
    
    return hasMajor && hasArea && hasTopic && hasMode && hasBriefOutline && hasMinAvailability && confirmed;
  }, [major, area, topic, mode, briefOutline, availability, confirmed]);

  const errors = formState.errors;

  async function onSubmit(values: MentorshipFormValues) {
    try {
      setSubmitting(true);
      const loadingToast = toast.loading("Submitting your mentorship application...");
      
      // Filter valid availability dates (at least 3 required)
      const validAvailability = values.availability
        .filter((avail) => {
          const hasDate = !!String(avail.date || "").trim();
          const hasStartTime = !!String(avail.startTime || "").trim();
          const hasEndTime = !!String(avail.endTime || "").trim();
          return hasDate && hasStartTime && hasEndTime && avail.startTime < avail.endTime;
        })
        .slice(0, 3); // Limit to 3 dates for database
      
      const payload = {
        major: String(values.major || "").trim(),
        areas: [String(values.area || "")].filter(Boolean),
        topics: [String(values.topic || "").trim()].filter(Boolean),
        mode: values.mode,
        briefOutline: String(values.briefOutline || "").trim(),
        availability: validAvailability.map((avail) => ({
          date: String(avail.date || "").trim(),
          timings: `${String(avail.startTime || "").trim()}-${String(avail.endTime || "").trim()}`,
        })),
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
      qc.invalidateQueries({ queryKey: alumniTalksKey });
      resetField("topic");
      resetField("area");
      resetField("briefOutline");

      if (redirectOnSuccess) {
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
      } else {
        onSubmitted?.();
      }
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
            <label className={labelBase}>Topic for mentoring - Talk</label>
            <div className="relative flex items-center">
              <input className={`${inputBase} ${errors.topic ? "border-rose-500 bg-rose-50" : ""}`} placeholder="e.g., React Performance" {...register("topic", { required: "Topic is required" })} />
            </div>
            {errors.topic && <span className={errorText}>{String(errors.topic.message || "Required")}</span>}
          </div>

          <div>
            <label className={labelBase}>Mode</label>
            <div className="relative flex items-center">
              <select className={`${inputBase} ${errors.mode ? "border-rose-500 bg-rose-50" : ""}`} {...register("mode", { required: "Mode is required" })}>
                <option value="Online">Online</option>
                <option value="Face to Face">Face to Face</option>
              </select>
            </div>
            {errors.mode && <span className={errorText}>{String(errors.mode.message || "Required")}</span>}
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Brief Outline</label>
            <div className="relative flex items-center">
              <textarea 
                rows={4}
                className={`${inputBase} ${errors.briefOutline ? "border-rose-500 bg-rose-50" : ""}`} 
                placeholder="Please provide a brief outline of your talk..." 
                {...register("briefOutline", { required: "Brief outline is required" })} 
              />
            </div>
            {errors.briefOutline && <span className={errorText}>{String(errors.briefOutline.message || "Required")}</span>}
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Availability (Please submit at least 3 dates)</label>
            <div className="space-y-4">
              {fields.map((field, index) => {
                const dateError = errors.availability?.[index]?.date;
                const startTimeError = errors.availability?.[index]?.startTime;
                const endTimeError = errors.availability?.[index]?.endTime;
                const hasError = dateError || startTimeError || endTimeError;
                
                return (
                  <div key={field.id} className={`p-4 border rounded-md ${hasError ? "border-rose-500 bg-rose-50" : "border-gray-200 bg-gray-50"}`}>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="mb-1 text-xs text-slate-700 font-medium block">Date</label>
                        <input 
                          type="date" 
                          className={`${inputBase} text-sm py-2`}
                          {...register(`availability.${index}.date` as const, { 
                            required: "Date is required",
                            validate: (value) => {
                              const selectedDate = new Date(value);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return selectedDate >= today || "Date must be today or in the future";
                            }
                          })} 
                        />
                        {dateError && <span className={errorText}>{String(dateError.message || "Required")}</span>}
                      </div>
                      <div>
                        <label className="mb-1 text-xs text-slate-700 font-medium block">Start Time</label>
                        <input 
                          type="time" 
                          className={`${inputBase} text-sm py-2`}
                          {...register(`availability.${index}.startTime` as const, { 
                            required: "Start time is required",
                            validate: (v) => (/^\d{2}:\d{2}$/.test(String(v)) || "Invalid time format")
                          })} 
                        />
                        {startTimeError && <span className={errorText}>{String(startTimeError.message || "Required")}</span>}
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="mb-1 text-xs text-slate-700 font-medium block">End Time</label>
                          <input 
                            type="time" 
                            className={`${inputBase} text-sm py-2`}
                            {...register(`availability.${index}.endTime` as const, { 
                              required: "End time is required",
                              validate: (v) => {
                                const start = watch(`availability.${index}.startTime`);
                                const end = String(v || "");
                                if (!/^\d{2}:\d{2}$/.test(end)) return "Invalid time format";
                                if (!start) return true;
                                return start < end || "End must be after start";
                              }
                            })} 
                          />
                          {endTimeError && <span className={errorText}>{String(endTimeError.message || "Required")}</span>}
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="px-3 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            title="Remove this date"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {fields.length < 3 && (
                <button
                  type="button"
                  onClick={() => append({ date: "", startTime: "", endTime: "" })}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#007bff] hover:text-[#006bff] hover:bg-blue-50 rounded-md transition-colors border border-blue-200"
                >
                  <span className="text-lg">+</span>
                  <span>Add More Availability</span>
                </button>
              )}
              {(() => {
                const validAvailability = availability.filter((avail) => {
                  const hasDate = !!String(avail.date || "").trim();
                  const hasStartTime = !!String(avail.startTime || "").trim();
                  const hasEndTime = !!String(avail.endTime || "").trim();
                  if (!hasDate || !hasStartTime || !hasEndTime) return false;
                  return avail.startTime < avail.endTime;
                });
                const hasMinAvailability = validAvailability.length >= 3;
                if (!hasMinAvailability && availability.some(a => a.date || a.startTime || a.endTime)) {
                  return (
                    <span className={errorText}>
                      Please provide at least 3 complete availability dates with valid times.
                    </span>
                  );
                }
                return null;
              })()}
              {errors.availability && typeof errors.availability.message === 'string' && (
                <span className={errorText}>{errors.availability.message}</span>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 text-[#007bff] border-gray-300 rounded focus:ring-[#007bff]"
                {...register("confirmed", { 
                  required: "You must confirm that all information is correct"
                })} 
              />
              <span className="text-sm text-slate-900 font-medium">
                I confirm that all above information is correct
              </span>
            </label>
            {errors.confirmed && <span className={errorText}>{String(errors.confirmed.message || "Required")}</span>}
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-3 mt-6">
          <button 
            type="submit" 
            disabled={!canSubmit || submitting} 
            className="px-5 py-2.5 text-[15px] font-medium w-full max-w-[130px] bg-[#007bff] hover:bg-[#006bff] text-white rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title={!canSubmit ? "Please fill in all required fields correctly and confirm the information" : ""}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      

    </form>
    </div>
  );
}