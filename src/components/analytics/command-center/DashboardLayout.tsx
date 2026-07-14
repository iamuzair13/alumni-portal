"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { AnalyticsPeriodFilter } from "@/components/analytics/v2/utils/periodFilter";
import { CommandCenterUnifiedHeader } from "./CommandCenterUnifiedHeader";
import { SectionAlumni } from "./sections/SectionAlumni";
import { SectionEngagements } from "./sections/SectionEngagements";
import { ENTRANCE } from "./animation/config";
import { getMotionProps, useReducedMotion } from "./animation/useReducedMotion";
import { useAnimationReplay } from "./animation/AnimationReplayContext";
import { ccPage, ccSection, ccTabActive, ccTabInactive } from "./theme";

type Tab = "alumni" | "engagements";

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
  performance: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("alumni");
  const reduced = useReducedMotion();
  const { replayKey } = useAnimationReplay();

  const sidebarEntrance = getMotionProps(reduced, {
    initial: { opacity: 0, y: ENTRANCE.y },
    animate: { opacity: 1, y: 0 },
    transition: { delay: ENTRANCE.sidebarDelay, duration: ENTRANCE.duration, ease: ENTRANCE.ease },
  });

  const alumniColumn = (
    <div className="flex h-full min-h-0 flex-col">
      <section
        aria-label="Alumni Intelligence"
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${ccSection.alumni}`}
      >
        <SectionAlumni data={data} trends={trends} isLoading={isLoading} />
      </section>
    </div>
  );

  const engagementsPanel = (
    <motion.div
      key={`engagements-${replayKey}`}
      {...sidebarEntrance}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth [overflow-scrolling:touch]">
        <SectionEngagements data={data} isLoading={isLoading} />
      </div>
    </motion.div>
  );

  return (
    <div className={`flex h-dvh flex-col overflow-hidden ${ccPage}`}>
      <CommandCenterUnifiedHeader
        facultyFilter={facultyFilter}
        onFacultyChange={onFacultyChange}
        facultyOptions={facultyOptions}
        isLoadingFaculties={isLoadingFaculties}
        periodFilter={periodFilter}
        onPeriodFilterChange={onPeriodFilterChange}
        performance={performance}
        data={data}
        isLoading={isLoading}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2">
        {/* Mobile / tablet tabs (<1024px) */}
        <div className="mb-1 flex shrink-0 gap-1 lg:hidden">
          {(
            [
              { id: "alumni" as const, label: "Alumni" },
              { id: "engagements" as const, label: "Engagements" },
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

        {/* Laptop & desktop — 8/4 column split, no outer scroll */}
        <div className="relative z-0 hidden min-h-0 flex-1 gap-2 overflow-hidden lg:grid lg:grid-cols-12 lg:grid-rows-1">
          <div className="flex h-full min-h-0 min-w-0 flex-col lg:col-span-8">{alumniColumn}</div>
          <section
            aria-label="Engagements"
            className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-4 ${ccSection.perks}`}
          >
            {engagementsPanel}
          </section>
        </div>

        {/* <1024px: tabbed, scroll within panel */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth lg:hidden">
          {tab === "alumni" ? (
            alumniColumn
          ) : (
            <section className={ccSection.perks}>{engagementsPanel}</section>
          )}
        </div>
      </div>
    </div>
  );
}
