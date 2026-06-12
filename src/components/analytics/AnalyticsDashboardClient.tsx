"use client";

import React from "react";
import { DashboardLayout } from "@/components/analytics/command-center/DashboardLayout";
import { AnimationReplayProvider } from "@/components/analytics/command-center/animation/AnimationReplayContext";
import { useCommandCenterData } from "@/components/analytics/command-center/hooks/useCommandCenterData";
import { PerformanceScore } from "@/components/analytics/v2/executive/PerformanceScore";
import { derivePerformanceScore } from "@/components/analytics/v2/utils/derivePerformanceScore";

export default function AnalyticsDashboardClient() {
  const {
    facultyFilter,
    setFacultyFilter,
    periodFilter,
    setPeriodFilter,
    facultyOptions,
    isLoadingFaculties,
    data,
    trends,
    isLoading,
    dataUpdatedAt,
  } = useCommandCenterData();

  const performance = (
    <PerformanceScore result={derivePerformanceScore(data)} variant="command" />
  );

  return (
    <AnimationReplayProvider>
      <DashboardLayout
        data={data}
        trends={trends}
        isLoading={isLoading}
        facultyFilter={facultyFilter}
        onFacultyChange={setFacultyFilter}
        facultyOptions={facultyOptions}
        isLoadingFaculties={isLoadingFaculties}
        periodFilter={periodFilter}
        onPeriodFilterChange={setPeriodFilter}
        dataUpdatedAt={dataUpdatedAt}
        performance={performance}
      />
    </AnimationReplayProvider>
  );
}
