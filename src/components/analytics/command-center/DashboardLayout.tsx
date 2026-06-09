"use client";

import React, { useState } from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { AnalyticsPeriodFilter } from "@/components/analytics/v2/utils/periodFilter";
import { CommandCenterHeader } from "./CommandCenterHeader";
import { SectionAlumni } from "./sections/SectionAlumni";
import { SectionPerks } from "./sections/SectionPerks";
import { SectionSystem } from "./sections/SectionSystem";
import { ccPage, ccSection, ccTabActive, ccTabInactive } from "./theme";

type Tab = "alumni" | "perks" | "system";

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
  scopeNotes,
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
  scopeNotes?: readonly string[];
  performance: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("alumni");

  return (
    <div className={`flex h-[calc(100dvh-68px)] flex-col overflow-hidden p-2 sm:p-3 ${ccPage}`}>
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

      {/* Mobile / tablet tabs (<1280px) */}
      <div className="mb-1.5 flex shrink-0 gap-1.5 min-[1280px]:hidden">
        {(
          [
            { id: "alumni" as const, label: "Alumni" },
            { id: "perks" as const, label: "Perks" },
            { id: "system" as const, label: "System" },
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

      {/* Desktop ≥1440px: full bento 8/4 + system strip */}
      <div className="hidden min-h-0 flex-1 grid-cols-12 gap-2 overflow-hidden min-[1440px]:grid min-[1440px]:grid-rows-[1fr_112px]">
        <div className="col-span-12 grid min-h-0 grid-cols-12 gap-2 overflow-hidden">
          <section aria-label="Alumni Intelligence" className={`col-span-8 min-h-0 overflow-hidden ${ccSection.alumni}`}>
            <SectionAlumni data={data} trends={trends} isLoading={isLoading} />
          </section>
          <section aria-label="Perks and Benefits" className={`col-span-4 min-h-0 overflow-hidden ${ccSection.perks}`}>
            <SectionPerks data={data} isLoading={isLoading} />
          </section>
        </div>
        <section aria-label="System and Faculty" className={`col-span-12 min-h-0 shrink-0 overflow-hidden ${ccSection.system}`}>
          <SectionSystem data={data} scopeNotes={scopeNotes} isLoading={isLoading} />
        </section>
      </div>

      {/* 1280–1439px: 2-column equal */}
      <div className="hidden min-h-0 flex-1 flex-col gap-2 overflow-hidden min-[1280px]:flex min-[1440px]:hidden">
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden">
          <section className={`min-h-0 overflow-hidden ${ccSection.alumni}`}>
            <SectionAlumni data={data} trends={trends} isLoading={isLoading} />
          </section>
          <section className={`min-h-0 overflow-hidden ${ccSection.perks}`}>
            <SectionPerks data={data} isLoading={isLoading} />
          </section>
        </div>
        <section className={`h-[112px] shrink-0 overflow-hidden ${ccSection.system}`}>
          <SectionSystem data={data} scopeNotes={scopeNotes} isLoading={isLoading} />
        </section>
      </div>

      {/* <1280px: tabbed single section */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden min-[1280px]:hidden">
        {tab === "alumni" ? (
          <section className={`min-h-0 flex-1 overflow-hidden ${ccSection.alumni}`}>
            <SectionAlumni data={data} trends={trends} isLoading={isLoading} />
          </section>
        ) : tab === "perks" ? (
          <section className={`min-h-0 flex-1 overflow-hidden ${ccSection.perks}`}>
            <SectionPerks data={data} isLoading={isLoading} />
          </section>
        ) : (
          <section className={`min-h-0 flex-1 overflow-hidden ${ccSection.system}`}>
            <SectionSystem data={data} scopeNotes={scopeNotes} isLoading={isLoading} />
          </section>
        )}
      </div>
    </div>
  );
}
