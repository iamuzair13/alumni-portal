"use client";

import React, { useMemo, useState } from "react";
import type { AnalyticsModule, AnalyticsPeriod, DashboardAnalytics } from "@/lib/analytics/types";
import { useAnalytics } from "@/app/queries/analytics";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import FilterBar from "./FilterBar";
import SummaryCards from "./SummaryCards";
import LineChartComponent from "./LineChartComponent";
import BarChartComponent from "./BarChartComponent";
import PieChartComponent from "./PieChartComponent";

const moduleLabel: Record<Exclude<AnalyticsModule, "dashboard">, string> = {
  alumni_cards: "Alumni Cards",
  alumni_talks: "Alumni Talks",
  alumni_chapters: "Alumni Chapters",
  alumni_association: "Alumni Association",
  scholarships: "Scholarships",
  memberships: "Memberships",
  leadership: "Leadership",
  jobs: "Jobs",
};

export default function AnalyticsDashboardClient() {
  const [module, setModule] = useState<AnalyticsModule>("dashboard");
  const [period, setPeriod] = useState<AnalyticsPeriod>("monthly");

  const q = useAnalytics({ module, period }, true);

  const isDashboard = module === "dashboard";
  const data = q.data as any;

  const topModule = useMemo(() => {
    if (!isDashboard) return null;
    const d = data as DashboardAnalytics | undefined;
    const list = d?.moduleTotals ?? [];
    let best: { label: string; total: number; growth: number } | null = null;
    for (const m of list) {
      const label = moduleLabel[m.module] ?? m.module;
      const total = Number(m.total ?? 0);
      const growth = Number(m.growth ?? 0);
      if (!best || total > best.total) best = { label, total, growth };
    }
    return best;
  }, [data, isDashboard]);

  const pie = useMemo(() => {
    if (!isDashboard) return { labels: [], series: [] as number[] };
    const d = data as DashboardAnalytics | undefined;
    const list = d?.moduleTotals ?? [];
    return {
      labels: list.map((m) => moduleLabel[m.module] ?? m.module),
      series: list.map((m) => Number(m.total ?? 0)),
    };
  }, [data, isDashboard]);

  return (
    <div className="space-y-6">
      <FilterBar
        module={module}
        period={period}
        onModuleChange={(v) => setModule(v)}
        onPeriodChange={(v) => setPeriod(v)}
        disabled={q.isFetching}
      />

      {q.isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <LoadingSpinner />
            Loading analytics…
          </div>
        </div>
      ) : q.isError ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">Failed to load analytics</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{String((q.error as any)?.message || "Unknown error")}</p>
          <button
            type="button"
            onClick={() => q.refetch()}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <SummaryCards total={Number(data?.total ?? 0)} growth={Number(data?.growth ?? 0)} topModule={topModule} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <LineChartComponent
              title="Trend"
              subtitle="Count by selected period"
              labels={Array.isArray(data?.labels) ? data.labels : []}
              data={Array.isArray(data?.data) ? data.data : []}
            />
            <BarChartComponent
              title="Comparison"
              subtitle="Bucket counts"
              labels={Array.isArray(data?.labels) ? data.labels : []}
              data={Array.isArray(data?.data) ? data.data : []}
            />
          </div>

          {isDashboard ? (
            <PieChartComponent
              title="Distribution"
              subtitle="Total by module (current period window)"
              labels={pie.labels}
              data={pie.series}
            />
          ) : null}

          {!data?.total ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
              No data found for this module/period window.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

