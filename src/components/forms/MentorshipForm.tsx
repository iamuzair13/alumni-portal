"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

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
  area: string;
  topic: string;
  day: string;
  start: string;
  end: string;
};

const inputBase = "mt-1 w-full rounded border border-neutral-300 p-2";
const labelBase = "block text-sm text-neutral-800";
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
  const { data: me, isLoading: loadingMe } = useCurrentAlumni(email ?? undefined);
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    formState,
    trigger,
  } = useForm<MentorshipFormValues>({
    defaultValues: { major: "", area: "", topic: "", day: "", start: "", end: "" },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const topic = watch("topic");
  const area = watch("area");
  const start = watch("start");
  const end = watch("end");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [email]);

  const canSubmit = useMemo(() => {
    const hasMajor = !!watch("major")?.trim();
    const hasArea = !!String(area || "").trim();
    const hasTopic = !!String(topic || "").trim();
    const validDay = WEEKDAYS.includes(watch("day") as typeof WEEKDAYS[number]);
    const t1 = String(start || "");
    const t2 = String(end || "");
    const fmt = /^\d{2}:\d{2}$/;
    const timeValid = fmt.test(t1) && fmt.test(t2) && t1 < t2;
    return hasMajor && hasArea && hasTopic && validDay && timeValid;
  }, [area, topic, start, end, watch]);

  const errors = formState.errors;

  async function onSubmit(values: MentorshipFormValues) {
    try {
      setSubmitting(true);
      setMessage(null);
      setError(null);
      const payload = {
        major: String(values.major || "").trim(),
        areas: [String(values.area || "").trim()].filter(Boolean),
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
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      setMessage("Submitted");
      qc.invalidateQueries({ queryKey: ["alumni", "participation", "list"] });
      resetField("topic");
      resetField("area");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Mentorship Program</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">Provide details to participate in mentorship sessions.</p>

      <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={async (e) => { e.preventDefault(); const ok = await trigger(); if (ok) handleSubmit(onSubmit)(); }}>
        <div>
          <label className={labelBase}>Faculty</label>
          <input className={`${inputBase} bg-gray-100`} value={me?.facultyname || ""} readOnly />
        </div>
        <div>
          <label className={labelBase}>Program</label>
          <input className={`${inputBase} bg-gray-100`} value={me?.degreetitle || ""} readOnly />
        </div>
        <div>
          <label className={labelBase}>Department</label>
          <input className={`${inputBase} bg-gray-100`} value={me?.departmentname || ""} readOnly />
        </div>

        <div>
          <label className={labelBase}>Major/Specialization</label>
          <input className={`${inputBase} ${errors.major ? "border-rose-500 bg-rose-50" : ""}`} placeholder="e.g., Data Science" {...register("major", { required: "Major is required" })} />
          {errors.major && <span className={errorText}>{String(errors.major.message || "Required")}</span>}
        </div>

        <div className="md:col-span-2">
          <label className={labelBase}>Area of Experience</label>
          <input className={`${inputBase} ${errors.area ? "border-rose-500 bg-rose-50" : ""}`} placeholder="e.g., Web Development" {...register("area", { required: "Area of expertise is required" })} />
          {errors.area && <span className={errorText}>{String(errors.area.message || "Required")}</span>}
        </div>

        <div className="md:col-span-2">
          <label className={labelBase}>Topic for mentoring</label>
          <input className={`${inputBase} ${errors.topic ? "border-rose-500 bg-rose-50" : ""}`} placeholder="e.g., React Performance" {...register("topic", { required: "Topic is required" })} />
          {errors.topic && <span className={errorText}>{String(errors.topic.message || "Required")}</span>}
        </div>

        <div>
          <label className={labelBase}>Availability (Weekday)</label>
          <select className={`${inputBase} ${errors.day ? "border-rose-500 bg-rose-50" : ""}`} {...register("day", { required: "Weekday is required", validate: (v) => WEEKDAYS.includes(v as typeof WEEKDAYS[number]) || "Weekday must be Monday to Friday" })}>
            <option value="">Select a day</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {errors.day && <span className={errorText}>{String(errors.day.message || "Required")}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelBase}>Start</label>
            <input type="time" className={`${inputBase} ${errors.start ? "border-rose-500 bg-rose-50" : ""}`} {...register("start", { required: "Start time is required", validate: (v) => (/^\d{2}:\d{2}$/.test(String(v)) || "Invalid time format") })} />
            {errors.start && <span className={errorText}>{String(errors.start.message || "Required")}</span>}
          </div>
          <div>
            <label className={labelBase}>End</label>
            <input type="time" className={`${inputBase} ${errors.end ? "border-rose-500 bg-rose-50" : ""}`} {...register("end", { required: "End time is required", validate: (v) => {
              const s = String(watch("start") || "");
              const e = String(v || "");
              if (!/^\d{2}:\d{2}$/.test(e)) return "Invalid time format";
              if (!/^\d{2}:\d{2}$/.test(s)) return true;
              return s < e || "End must be after start";
            } })} />
            {errors.end && <span className={errorText}>{String(errors.end.message || "Required")}</span>}
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={!canSubmit || submitting || loadingMe} className={`rounded-md px-4 py-2 text-white ${canSubmit && !submitting ? "bg-indigo-600" : "bg-gray-400"}`}>Submit</button>
          {submitting && <span className="text-sm text-gray-500">Submitting…</span>}
          {message && <span className="text-sm text-green-600">{message}</span>}
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}