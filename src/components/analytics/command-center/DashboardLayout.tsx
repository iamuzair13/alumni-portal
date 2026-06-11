"use client";

import React, { useState } from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { AnalyticsPeriodFilter } from "@/components/analytics/v2/utils/periodFilter";
import { CommandCenterHeader } from "./CommandCenterHeader";
import { SectionAlumni } from "./sections/SectionAlumni";
import { SectionPerks } from "./sections/SectionPerks";
import { SectionTrainedAdmins } from "./sections/SectionTrainedAdmins";
import { ccPage, ccSection, ccTabActive, ccTabInactive } from "./theme";

type Tab = "alumni" | "perks";

export function DashboardLayout({
  data,
  trends,
  isLoading,
  facultyFilter,
  onFacultyChange,
  facultyOptions,
  isLoadingFaculties,
  periodFilter,
  onPeriodFilterChange,
  dataUpdatedAt,
  performance,
}: {
  data: ManagementDashboardPayload | undefined;
  trends: AlumniTrendPoint[] | undefined;
  isLoading: boolean;
  facultyFilter: string;
  onFacultyChange: (v: string) => void;
  facultyOptions: Array<{ id: number; faculty_name: string }>;
  isLoadingFaculties: boolean;
  periodFilter: AnalyticsPeriodFilter;
  onPeriodFilterChange: (f: AnalyticsPeriodFilter) => void;
  dataUpdatedAt: number;
  performance: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("alumni");

  const alumniColumn = (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5">
      <section
        aria-label="Alumni Intelligence"
        className={`min-h-0 h-[72vh] overflow-y-auto ${ccSection.alumni}`}
      >
        <SectionAlumni data={data} trends={trends} isLoading={isLoading} />
      </section>
      <section
        aria-label="Trained Faculty Admins"
        className={`h-[13vh] shrink-0 overflow-hidden ${ccSection.admins}`}
      >
        <SectionTrainedAdmins data={data} isLoading={isLoading} />
      </section>
    </div>
  );

  return (
    <div className={`flex h-[calc(100dvh-68px)] flex-col overflow-hidden p-1.5 sm:p-2 ${ccPage}`}>
      <CommandCenterHeader
        facultyFilter={facultyFilter}
        onFacultyChange={onFacultyChange}
        facultyOptions={facultyOptions}
        isLoadingFaculties={isLoadingFaculties}
        periodFilter={periodFilter}
        onPeriodFilterChange={onPeriodFilterChange}
        dataUpdatedAt={dataUpdatedAt}
        performance={performance}
      />

      {/* Mobile / tablet tabs (<1024px) */}
      <div className="mb-1 flex shrink-0 gap-1 lg:hidden">
        {(
          [
            { id: "alumni" as const, label: "Alumni" },
            { id: "perks" as const, label: "Perks" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? ccTabActive : ccTabInactive
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Laptop & desktop — equal-height columns, no outer scroll */}
      <div className="relative z-0 hidden min-h-0 flex-1 gap-2 overflow-hidden lg:grid lg:grid-cols-2 lg:grid-rows-1 xl:grid-cols-12">
        <div className="flex h-full min-h-0 flex-col lg:col-span-1 xl:col-span-8">{alumniColumn}</div>
        <section
          aria-label="Perks and Benefits"
          className={`flex h-full min-h-0 flex-col overflow-hidden lg:col-span-1 xl:col-span-4 ${ccSection.perks}`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SectionPerks data={data} isLoading={isLoading} />
          </div>
        </section>
      </div>

      {/* <1024px: tabbed, scroll within panel */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:hidden">
        {tab === "alumni" ? (
          alumniColumn
        ) : (
          <section className={ccSection.perks}>
            <SectionPerks data={data} isLoading={isLoading} />
          </section>
        )}
      </div>
    </div>
  );
}
