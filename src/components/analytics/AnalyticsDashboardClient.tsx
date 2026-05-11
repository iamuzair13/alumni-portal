"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ManagementDashboardApiResponse, ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import ManagementSectionA from "@/components/analytics/management/ManagementSectionA";
import ManagementSectionB from "@/components/analytics/management/ManagementSectionB";
import ManagementSectionC from "@/components/analytics/management/ManagementSectionC";
import ManagementSectionD from "@/components/analytics/management/ManagementSectionD";
import { DashboardIcons, KpiCard } from "@/components/analytics/management/DashboardPrimitives";
import { formatKpiValue } from "@/components/analytics/management/dashboardFormat";

const toc = [
  { id: "#section-a", label: "A · Alumni" },
  { id: "#section-b", label: "B · Engagement" },
  { id: "#section-c", label: "C · Development" },
  { id: "#section-d", label: "D · Perks" },
] as const;

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

  const { data: dashboard, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ["analytics-realtime-dashboard", facultyFilter, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("facultyId", facultyFilter);
      params.set("timeRange", timeRange);
      const res = await fetch(`/api/analytics/realtime-dashboard?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as ManagementDashboardApiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load analytics");
      return json;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const data = dashboard as ManagementDashboardPayload | undefined;
  const ah = data?.alumniHeadline;
  const cardsStatus = data?.sectionB?.cardsStatus;

  const kpis = [
    { title: "Total Entries", value: formatKpiValue(ah?.total), subtitle: "Live database count", icon: DashboardIcons.entries, color: "indigo" as const },
    { title: "Verified Alumni", value: formatKpiValue(ah?.verified), subtitle: "Identity confirmed", icon: DashboardIcons.verified, color: "emerald" as const },
    { title: "Honor Cards Issued", value: formatKpiValue(cardsStatus?.delivered), subtitle: "Delivered", icon: DashboardIcons.card, color: "amber" as const },
    { title: "Category A+", value: formatKpiValue(ah?.category?.aPlus), subtitle: "Highest distinction", icon: DashboardIcons.star, color: "violet" as const },
    { title: "Category A", value: formatKpiValue(ah?.category?.a), subtitle: "Distinguished alumni", icon: DashboardIcons.star, color: "sky" as const },
    { title: "Category B", value: formatKpiValue(ah?.category?.b), subtitle: "Active contributors", icon: DashboardIcons.star, color: "orange" as const },
    { title: "Category C", value: formatKpiValue(ah?.category?.c), subtitle: "Regular members", icon: DashboardIcons.star, color: "slate" as const },
    { title: "Category D", value: formatKpiValue(ah?.category?.d), subtitle: "Basic tier", icon: DashboardIcons.star, color: "rose" as const },
  ];

  const isLoading = isLoadingDashboard;

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 dark:bg-gray-950 md:p-8">
      <header className="mb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                {DashboardIcons.chart}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                  Alumni Management Dashboard
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Real-time analytics — filters apply to alumni-linked metrics; see scope notes below.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-gray-200/80 bg-gray-50/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90 md:-mx-8 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap gap-2" aria-label="Dashboard sections">
            {toc.map((t) => (
              <a
                key={t.id}
                href={t.id}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                {DashboardIcons.filter}
              </div>
              <select
                value={facultyFilter}
                onChange={(e) => setFacultyFilter(e.target.value)}
                disabled={isLoadingFaculties}
                className="w-full min-w-[200px] appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-8 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-700"
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
                {DashboardIcons.calendar}
              </div>
             
            </div>
          </div>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} title={kpi.title} value={kpi.value} subtitle={kpi.subtitle} icon={kpi.icon} color={kpi.color} />
        ))}
      </section>

      <ManagementSectionA data={data} isLoading={isLoading} timeRange={timeRange} />
      <ManagementSectionB data={data} isLoading={isLoading} />
      <ManagementSectionC data={data} isLoading={isLoading} />
      <ManagementSectionD data={data} isLoading={isLoading} />

      {dashboard?.scopeNotes && dashboard.scopeNotes.length > 0 && (
        <aside className="mt-8 rounded-xl border border-gray-200 bg-white/80 p-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
          <p className="font-semibold text-gray-800 dark:text-gray-200">Data scope</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {dashboard.scopeNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
