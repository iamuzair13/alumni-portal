"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
  areas: string[];
  topicInput: string;
  topics: string[];
  day: string;
  start: string;
  end: string;
};

const inputBase = "mt-1 w-full rounded border border-neutral-300 p-2";
const labelBase = "block text-sm text-neutral-800";
const optionChip = "inline-flex items-center gap-2 rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs mr-2 mb-2";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const AREA_OPTIONS = [
  "Career Guidance",
  "Technical Coaching",
  "Interview Preparation",
  "Networking",
  "Resume Review",
  "Industry Insights",
] as const;

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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    resetField,
  } = useForm<MentorshipFormValues>({
    defaultValues: { major: "", areas: [], topicInput: "", topics: [], day: "", start: "", end: "" },
  });

  const topics = watch("topics");
  const areas = watch("areas");
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
    const hasAreas = (areas || []).length > 0;
    const hasTopics = (topics || []).length > 0;
    const validDay = WEEKDAYS.includes(watch("day") as typeof WEEKDAYS[number]);
    const t1 = String(start || "");
    const t2 = String(end || "");
    const fmt = /^\d{2}:\d{2}$/;
    const timeValid = fmt.test(t1) && fmt.test(t2) && t1 < t2;
    return hasMajor && hasAreas && hasTopics && validDay && timeValid;
  }, [areas, topics, start, end, watch]);

  function addTopicFromInput() {
    const raw = watch("topicInput") || "";
    const t = raw.trim();
    if (!t) return;
    const next = Array.from(new Set([...(topics || []), t]));
    setValue("topics", next);
    setValue("topicInput", "");
  }

  function removeTopic(t: string) {
    const next = (topics || []).filter((x) => x !== t);
    setValue("topics", next);
  }

  function toggleArea(a: string) {
    const set = new Set(areas || []);
    if (set.has(a)) set.delete(a); else set.add(a);
    setValue("areas", Array.from(set));
  }

  async function onSubmit(values: MentorshipFormValues) {
    try {
      setSubmitting(true);
      setMessage(null);
      setError(null);
      const payload = {
        major: String(values.major || "").trim(),
        areas: Array.from(new Set(values.areas || [])).map((s) => String(s).trim()).filter(Boolean),
        topics: Array.from(new Set(values.topics || [])).map((s) => String(s).trim()).filter(Boolean),
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
      resetField("topics");
      resetField("topicInput");
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

      <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
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
          <input className={inputBase} placeholder="e.g., Data Science" {...register("major", { required: true })} />
        </div>

        <div className="md:col-span-2">
          <label className={labelBase}>Area of Experience</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {AREA_OPTIONS.map((a) => {
              const active = (areas || []).includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  className={`${optionChip} ${active ? "bg-indigo-100 text-indigo-700" : ""}`}
                  onClick={() => toggleArea(a)}
                >{a}</button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelBase}>Topics for mentoring</label>
          <div className="mt-1 flex items-center gap-2">
            <input className={`${inputBase} flex-1`} placeholder="Type and press Enter" {...register("topicInput")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopicFromInput(); } }} />
            <button type="button" className="rounded-md bg-indigo-600 px-3 py-2 text-white" onClick={addTopicFromInput}>Add</button>
          </div>
          <div className="mt-2">
            {(topics || []).map((t) => (
              <span key={t} className={optionChip}>
                <span>{t}</span>
                <button type="button" className="text-xs text-gray-500" onClick={() => removeTopic(t)}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className={labelBase}>Availability (Weekday)</label>
          <select className={inputBase} {...register("day", { required: true })}>
            <option value="">Select a day</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelBase}>Start</label>
            <input type="time" className={inputBase} {...register("start", { required: true })} />
          </div>
          <div>
            <label className={labelBase}>End</label>
            <input type="time" className={inputBase} {...register("end", { required: true })} />
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