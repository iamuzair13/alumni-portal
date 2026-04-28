"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FacultyRegistrationsBarChart from "@/components/analytics/FacultyRegistrationsBarChart";

type TableColumn = { key: string; label: string; align?: "left" | "right" | "center" };
type TableRow = Record<string, string | number>;

/* ─── Icon System ─── */
const Icons = {
  entries: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
  ),
  verified: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  card: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
  ),
  star: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
  ),
  filter: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
  ),
  calendar: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  chart: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  ),
  trophy: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
  ),
  briefcase: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  ),
  gift: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
  ),
  arrowUp: (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
  ),
  arrowDown: (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
  ),
};

/* ─── Skeleton Loader ─── */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800 ${className}`} />
  );
}

/* ─── Enhanced Section Wrapper ─── */
function SectionWrapper({
  title,
  subtitle,
  children,
  icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

/* ─── Enhanced KPI Card ─── */
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = "indigo",
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "orange" | "slate";
  trend?: { value: string; positive: boolean };
}) {
  const colorMap = {
    indigo: "from-indigo-500 to-blue-600 text-indigo-600 bg-indigo-50 dark:from-indigo-400 dark:to-blue-500 dark:text-indigo-400 dark:bg-indigo-500/10",
    emerald: "from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50 dark:from-emerald-400 dark:to-teal-500 dark:text-emerald-400 dark:bg-emerald-500/10",
    amber: "from-amber-500 to-orange-600 text-amber-600 bg-amber-50 dark:from-amber-400 dark:to-orange-500 dark:text-amber-400 dark:bg-amber-500/10",
    rose: "from-rose-500 to-pink-600 text-rose-600 bg-rose-50 dark:from-rose-400 dark:to-pink-500 dark:text-rose-400 dark:bg-rose-500/10",
    sky: "from-sky-500 to-cyan-600 text-sky-600 bg-sky-50 dark:from-sky-400 dark:to-cyan-500 dark:text-sky-400 dark:bg-sky-500/10",
    violet: "from-violet-500 to-purple-600 text-violet-600 bg-violet-50 dark:from-violet-400 dark:to-purple-500 dark:text-violet-400 dark:bg-violet-500/10",
    orange: "from-orange-500 to-red-600 text-orange-600 bg-orange-50 dark:from-orange-400 dark:to-red-500 dark:text-orange-400 dark:bg-orange-500/10",
    slate: "from-slate-500 to-gray-600 text-slate-600 bg-slate-50 dark:from-slate-400 dark:to-gray-500 dark:text-slate-400 dark:bg-slate-500/10",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/50">
      <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${colorMap[color]} opacity-[0.07] transition-transform duration-300 group-hover:scale-150`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={`inline-flex rounded-lg p-2.5 ${colorMap[color].split(' ').slice(2, 4).join(' ')}`}>
            {icon}
          </div>
          {trend && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${trend.positive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
              {trend.positive ? Icons.arrowUp : Icons.arrowDown}
              {trend.value}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs font-medium text-gray-400 dark:text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Enhanced Stat Card ─── */
function StatCard({
  label,
  value,
  hint,
  color = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  color?:"sky"| "slate" | "indigo" | "emerald" | "amber" | "rose" | "violet" ;
}) {
  const borderColors = {
    slate: "border-l-slate-400 dark:border-l-slate-500",
    indigo: "border-l-indigo-400 dark:border-l-indigo-500",
    emerald: "border-l-emerald-400 dark:border-l-emerald-500",
    amber: "border-l-amber-400 dark:border-l-amber-500",
    rose: "border-l-rose-400 dark:border-l-rose-500",
    violet: "border-l-violet-400 dark:border-l-violet-500",
    sky: "border-l-sky-400 dark:border-l-sky-500",
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-gray-200/80 border-l-4 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50 ${borderColors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p> : null}
    </div>
  );
}

/* ─── Enhanced Data Table ─── */
function DataTable({ columns, rows, isLoading }: { columns: TableColumn[]; rows: TableRow[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {columns.map((_, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800">
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/80">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, idx) => {
              const isTotal = row.faculty === "Total" || row.metric === "Total";
              return (
                <tr
                  key={idx}
                  className={`transition-colors duration-150 ${
                    isTotal
                      ? "bg-gray-50/80 font-semibold dark:bg-gray-800/50"
                      : "hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3.5 text-gray-700 dark:text-gray-300 ${
                        c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left"
                      } ${isTotal ? "text-gray-900 dark:text-white" : ""}`}
                    >
                      {row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Progress Bar ─── */
function ProgressBar({ value, max, color = "indigo" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${colorMap[color] || colorMap.indigo}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function AnalyticsDashboardClient() {
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("This Quarter");

  const { data: facultyOptions, isLoading: isLoadingFaculties } = useQuery({
    queryKey: ["organization-faculties", "analytics-filter"],
    queryFn: async () => {
      const res = await fetch("/api/organization/faculties", { headers: { accept: "application/json" } });
      const json = (await res.json()) as {
        success?: boolean;
        faculties?: Array<{ id: number; faculty_name: string }>;
      };
      if (!res.ok || !json.success) throw new Error("Failed to load faculties");
      return json.faculties ?? [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: realtime, isLoading: isLoadingRealtime } = useQuery({
    queryKey: ["analytics-realtime-dashboard", facultyFilter, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("facultyId", facultyFilter);
      params.set("timeRange", timeRange);
      const res = await fetch(`/api/analytics/realtime-dashboard?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error("Failed to load realtime analytics");
      return json;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: alumniCounts, isLoading: isLoadingAlumni } = useQuery({
    queryKey: ["alumni-counts-kpis", facultyFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facultyFilter !== "all") params.append("faculty", facultyFilter);
      const res = await fetch(`/api/alumni/counts${params.toString() ? `?${params.toString()}` : ""}`, {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as {
        total?: number;
        verified?: number;
        category?: { aPlus?: number; a?: number; b?: number; c?: number; d?: number };
      };
      if (!res.ok) throw new Error("Failed to load alumni counts");
      return json;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const formatKpiValue = (value: number | null | undefined): string =>
    typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
  const fmt = (value: number | null | undefined): string | number =>
    typeof value === "number" && Number.isFinite(value) ? value : "—";

  const cardsStatusData = ((realtime?.sectionB as Record<string, unknown> | undefined)?.cardsStatus ??
    {}) as Record<string, number | null | undefined>;

  const kpis = [
    { title: "Total Entries", value: formatKpiValue(alumniCounts?.total), subtitle: alumniCounts?.total == null ? "Syncing data..." : "Live database count", icon: Icons.entries, color: "indigo" as const },
    { title: "Verified Alumni", value: formatKpiValue(alumniCounts?.verified), subtitle: alumniCounts?.verified == null ? "Syncing data..." : "Identity confirmed", icon: Icons.verified, color: "emerald" as const },
    { title: "Honor Cards Issued", value: formatKpiValue(cardsStatusData.delivered), subtitle: cardsStatusData.delivered == null ? "Syncing data..." : "Successfully delivered", icon: Icons.card, color: "amber" as const },
    { title: "Category A+", value: formatKpiValue(alumniCounts?.category?.aPlus), subtitle: alumniCounts?.category?.aPlus == null ? "Syncing data..." : "Highest distinction", icon: Icons.star, color: "violet" as const },
    { title: "Category A", value: formatKpiValue(alumniCounts?.category?.a), subtitle: alumniCounts?.category?.a == null ? "Syncing data..." : "Distinguished alumni", icon: Icons.star, color: "sky" as const },
    { title: "Category B", value: formatKpiValue(alumniCounts?.category?.b), subtitle: alumniCounts?.category?.b == null ? "Syncing data..." : "Active contributors", icon: Icons.star, color: "orange" as const },
    { title: "Category C", value: formatKpiValue(alumniCounts?.category?.c), subtitle: alumniCounts?.category?.c == null ? "Syncing data..." : "Regular members", icon: Icons.star, color: "slate" as const },
    { title: "Category D", value: formatKpiValue(alumniCounts?.category?.d), subtitle: alumniCounts?.category?.d == null ? "Syncing data..." : "Basic tier", icon: Icons.star, color: "rose" as const },
  ];

  const facultySource = ((realtime?.sectionA as Record<string, unknown> | undefined)?.facultyRows ?? []) as Array<{
    faculty: string;
    registrations: number | null;
  }>;
  const facultyTotal = facultySource.reduce((sum, r) => sum + (typeof r.registrations === "number" ? r.registrations : 0), 0);
  const maxRegistrations = Math.max(...facultySource.map(r => typeof r.registrations === "number" ? r.registrations : 0), 1);
  
  const facultyChartData = facultySource
    .filter((r) => typeof r.registrations === "number")
    .map((r) => ({
      faculty: r.faculty || "Unknown",
      registrations: Number(r.registrations ?? 0),
    }));
    
  const facultyRows: TableRow[] = facultySource.map((r) => ({
    faculty: r.faculty || "Unknown",
    registrations: fmt(r.registrations),
    contribution: facultyTotal > 0 && typeof r.registrations === "number" ? `${((r.registrations / facultyTotal) * 100).toFixed(1)}%` : "—",
  }));

  const activitySource = ((realtime?.sectionB as Record<string, unknown> | undefined)?.activities ??
    {}) as Record<string, { quarter: number | null; ytd: number | null }>;
  const chapterEventsSource = (activitySource as unknown as Record<string, { quarter?: number | null; ytd?: number | null; total?: number | null }>).chapterEvents;
  
  const engagementActivityRows: TableRow[] = [
    { activity: "Mentorship Sessions", quarter: fmt(activitySource.mentorshipSessions?.quarter), ytd: fmt(activitySource.mentorshipSessions?.ytd) },
    { activity: "Seminars Participation", quarter: fmt(activitySource.seminarsParticipation?.quarter), ytd: fmt(activitySource.seminarsParticipation?.ytd) },
    { activity: "Conferences Participation", quarter: fmt(activitySource.conferencesParticipation?.quarter), ytd: fmt(activitySource.conferencesParticipation?.ytd) },
    { activity: "Alumni Talks", quarter: fmt(activitySource.alumniTalks?.quarter), ytd: fmt(activitySource.alumniTalks?.ytd) },
    { activity: "High Achievers Recognition", quarter: fmt(activitySource.highAchieversRecognition?.quarter), ytd: fmt(activitySource.highAchieversRecognition?.ytd) },
    { activity: "Wellbeing Support", quarter: fmt(activitySource.wellbeingSupport?.quarter), ytd: fmt(activitySource.wellbeingSupport?.ytd) },
  ];

  const careerSource = ((realtime?.sectionC as Record<string, unknown> | undefined)?.career ??
    {}) as Record<string, { quarter: number | null; ytd: number | null }>;
  const careerRows: TableRow[] = [
    { item: "Recruitment Drives", quarter: fmt(careerSource.recruitmentDrives?.quarter), ytd: fmt(careerSource.recruitmentDrives?.ytd) },
    { item: "Jobs Posted (UOL)", quarter: fmt(careerSource.jobsPostedUol?.quarter), ytd: fmt(careerSource.jobsPostedUol?.ytd) },
    { item: "Jobs Posted (Other)", quarter: fmt(careerSource.jobsPostedOtherEmployers?.quarter), ytd: fmt(careerSource.jobsPostedOtherEmployers?.ytd) },
    { item: "Startups Support", quarter: fmt(careerSource.startupsSupport?.quarter), ytd: fmt(careerSource.startupsSupport?.ytd) },
    { item: "Upskill Courses", quarter: fmt(careerSource.upskillCourses?.quarter), ytd: fmt(careerSource.upskillCourses?.ytd) },
  ];

  const scholarshipSource = ((realtime?.sectionC as Record<string, unknown> | undefined)?.scholarships ??
    {}) as Record<string, { applied: number | null; processed: number | null }>;
  const scholarshipRows: TableRow[] = [
    { scholarship: "Kinship", applied: fmt(scholarshipSource.kinship?.applied), processed: fmt(scholarshipSource.kinship?.processed) },
    { scholarship: "Masters / PhD", applied: fmt(scholarshipSource.mastersPhd?.applied), processed: fmt(scholarshipSource.mastersPhd?.processed) },
    { scholarship: "IQ Programs", applied: fmt(scholarshipSource.iqPrograms?.applied), processed: fmt(scholarshipSource.iqPrograms?.processed) },
  ];

  const membershipSource = ((realtime?.sectionD as Record<string, unknown> | undefined)?.memberships ??
    {}) as Record<string, number | null>;
  const perksRows: TableRow[] = [
    { membership: "Gym", active: fmt(membershipSource.gym) },
    { membership: "Swimming Pool", active: fmt(membershipSource.swimmingPool) },
    { membership: "Free Memberships", active: fmt(membershipSource.freeMemberships) },
    { membership: "Healthcare Discounts", active: fmt(membershipSource.healthcareDiscounts) },
    { membership: "Vehicle Stickers", active: fmt(membershipSource.vehicleStickers) },
  ];

  const merchantSource = ((realtime?.sectionD as Record<string, unknown> | undefined)?.merchants ??
    []) as Array<{ merchant: string; discount: string; reference: string }>;
  const merchantRows: TableRow[] =
    merchantSource.length > 0
      ? merchantSource
      : [{ merchant: "No data available", discount: "—", reference: "—" }];

  const cardsStatus = ((realtime?.sectionB as Record<string, unknown> | undefined)?.cardsStatus ??
    {}) as Record<string, number | null>;
  const honorStatuses = [
    { label: "Applied", value: fmt(cardsStatus.totalCards), color: "slate" as const },
    { label: "Under Review", value: fmt(cardsStatus.review), color: "amber" as const },
    { label: "On-hold", value: fmt(cardsStatus.onHold), color: "rose" as const },
    { label: "Printing", value: fmt(cardsStatus.underPrinting), color: "sky" as const },
    { label: "Ready", value: fmt(cardsStatus.readyForDelivery), color: "indigo" as const },
    { label: "Delivered", value: fmt(cardsStatus.delivered), color: "emerald" as const },
  ];
  
  const chapterStats = ((realtime?.sectionB as Record<string, unknown> | undefined)?.chaptersAssociations ??
    {}) as Record<string, number | null>;
  const discountCategories = ((realtime?.sectionD as Record<string, unknown> | undefined)?.discountCategories ??
    {}) as Record<string, number | null>;
  const giveBackFinancialAssistance = ((realtime?.sectionC as Record<string, unknown> | undefined)
    ?.giveBackFinancialAssistance ?? null) as number | null;

  const isLoading = isLoadingRealtime || isLoadingAlumni;

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 dark:bg-gray-950 md:p-8">
      {/* ─── Header ─── */}
      <header className="mb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                {Icons.chart}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                  Alumni Management Dashboard
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Real-time analytics and engagement overview
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                {Icons.filter}
              </div>
              <select
                value={facultyFilter}
                onChange={(e) => setFacultyFilter(e.target.value)}
                disabled={isLoadingFaculties}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-700"
              >
                <option value="all">All Faculties</option>
                {(facultyOptions ?? []).map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.faculty_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                {Icons.calendar}
              </div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-700"
              >
                <option>This Quarter</option>
                <option>YTD</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ─── KPI Grid ─── */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            icon={kpi.icon}
            color={kpi.color}
          />
        ))}
      </section>

      {/* ─── Alumni Database ─── */}
      <SectionWrapper
        title="Alumni Database"
        subtitle="Registration distribution and faculty breakdown"
        icon={Icons.users}
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Faculty Registrations
              </h3>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                {timeRange}
              </span>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
              <FacultyRegistrationsBarChart
                data={facultyChartData}
                subtitle={timeRange === "YTD" ? "Year-to-date registrations by faculty" : "Quarterly registrations by faculty"}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detailed Breakdown</h3>
            <DataTable
              isLoading={isLoading}
              columns={[
                { key: "faculty", label: "Faculty" },
                { key: "registrations", label: "Registrations", align: "right" },
                { key: "contribution", label: "Contribution", align: "right" },
              ]}
              rows={[
                ...facultyRows,
                {
                  faculty: "Total",
                  registrations: facultyTotal || "—",
                  contribution: facultyTotal > 0 ? "100%" : "—",
                },
              ]}
            />
            {!isLoading && facultyTotal > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Registration Distribution</p>
                {facultySource.filter(r => typeof r.registrations === "number").map((r, i) => (
                  <div key={r.faculty} className="flex items-center gap-3">
                    <span className="w-24 truncate text-xs text-gray-600 dark:text-gray-400">{r.faculty}</span>
                    <ProgressBar value={r.registrations ?? 0} max={maxRegistrations} color={["indigo", "emerald", "amber", "rose", "sky", "violet"][i % 6]} />
                    <span className="w-10 text-right text-xs font-medium tabular-nums text-gray-700 dark:text-gray-300">
                      {((r.registrations ?? 0) / facultyTotal * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionWrapper>

      {/* ─── Engagement & Networking ─── */}
      <div className="mt-6">
        <SectionWrapper
          title="Engagement & Networking"
          subtitle="Chapter activities, honor cards, and participation metrics"
          icon={Icons.users}
        >
          <div className="space-y-8">
            {/* Chapters */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Chapters & Associations
              </h3>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="National" value={fmt(chapterStats.nationalChapters)} color="indigo" />
                <StatCard label="International" value={fmt(chapterStats.internationalChapters)} color="emerald" />
                <StatCard label="Associations" value={fmt(chapterStats.associations)} color="amber" />
                <StatCard label="Members" value={fmt(chapterStats.members)} color="sky" />
                <StatCard label="Leaders" value={fmt(chapterStats.leadersAppointed)} color="violet" />
                <StatCard
                  label="Meetups"
                  value={fmt(chapterStats.meetupsTotal)}
                  hint={`Q: ${fmt(chapterStats.meetupsQuarter)} · YTD: ${fmt(chapterStats.meetupsYtd)}`}
                  color="rose"
                />
              </div>
              <DataTable
                isLoading={isLoading}
                columns={[
                  { key: "metric", label: "Metric" },
                  { key: "quarter", label: "This Quarter", align: "right" },
                  { key: "ytd", label: "YTD", align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                rows={[
                  { metric: "Meetups", quarter: fmt(chapterStats.meetupsQuarter), ytd: fmt(chapterStats.meetupsYtd), total: fmt(chapterStats.meetupsTotal) },
                  { metric: "Chapter Events", quarter: fmt(chapterEventsSource?.quarter), ytd: fmt(chapterEventsSource?.ytd), total: fmt(chapterEventsSource?.total) },
                ]}
              />
            </div>

            {/* Honor Cards */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Alumni Honor Cards Status
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {honorStatuses.map((s) => (
                  <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />
                ))}
              </div>
            </div>

            {/* Engagement Activities */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Engagement Activities
              </h3>
              <DataTable
                isLoading={isLoading}
                columns={[
                  { key: "activity", label: "Activity" },
                  { key: "quarter", label: "This Quarter", align: "right" },
                  { key: "ytd", label: "YTD", align: "right" },
                ]}
                rows={engagementActivityRows}
              />
            </div>
          </div>
        </SectionWrapper>
      </div>

      {/* ─── Development & Support ─── */}
      <div className="mt-6">
        <SectionWrapper
          title="Development & Support"
          subtitle="Career services, scholarships, and alumni contributions"
          icon={Icons.briefcase}
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Career Services
                </h3>
                <DataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "item", label: "Service" },
                    { key: "quarter", label: "This Quarter", align: "right" },
                    { key: "ytd", label: "YTD", align: "right" },
                  ]}
                  rows={careerRows}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  Academic Scholarships
                </h3>
                <DataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "scholarship", label: "Scholarship Type" },
                    { key: "applied", label: "Applied", align: "right" },
                    { key: "processed", label: "Processed", align: "right" },
                  ]}
                  rows={scholarshipRows}
                />
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Alumni Give Back
                </h3>
                <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-transparent p-6 dark:border-rose-900/30 dark:from-rose-900/10">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Financial Assistance to Students</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {typeof giveBackFinancialAssistance === "number" ? `Rs. ${giveBackFinancialAssistance.toLocaleString()}` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Year-to-date disbursement</p>
                </div>
              </div>
            </div>
          </div>
        </SectionWrapper>
      </div>

      {/* ─── Perks & Benefits ─── */}
      <div className="mt-6 mb-8">
        <SectionWrapper
          title="Perks & Benefits"
          subtitle="Memberships, merchant partnerships, and discount categories"
          icon={Icons.gift}
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Memberships
              </h3>
              <DataTable
                isLoading={isLoading}
                columns={[
                  { key: "membership", label: "Type" },
                  { key: "active", label: "Active", align: "right" },
                ]}
                rows={perksRows}
              />
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Discount Categories
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Dining & Cafes" value={fmt(discountCategories.diningAndCafes)} color="amber" />
                <StatCard label="Retail & Shopping" value={fmt(discountCategories.retailAndShopping)} color="indigo" />
                <StatCard label="Travel & Leisure" value={fmt(discountCategories.travelAndLeisure)} color="sky" />
                <StatCard label="Health & Wellness" value={fmt(discountCategories.healthAndWellness)} color="emerald" />
                <StatCard label="Professional" value={fmt(discountCategories.professionalServices)} color="violet" />
                <StatCard label="Financial" value={fmt(discountCategories.financialServices)} color="rose" />
              </div>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Merchant Details
              </h3>
              <DataTable
                isLoading={isLoading}
                columns={[
                  { key: "merchant", label: "Merchant" },
                  { key: "discount", label: "Discount" },
                  { key: "reference", label: "Reference" },
                ]}
                rows={merchantRows}
              />
            </div>
          </div>
        </SectionWrapper>
      </div>
    </div>
  );
}