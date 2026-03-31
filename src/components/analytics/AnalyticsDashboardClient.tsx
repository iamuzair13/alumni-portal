"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AnalyticsModule, AnalyticsPeriod, DashboardAnalytics } from "@/lib/analytics/types";
import { useAnalytics } from "@/app/queries/analytics";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import FilterBar from "./FilterBar";
import SummaryCards from "./SummaryCards";
import LineChartComponent from "./LineChartComponent";
import BarChartComponent from "./BarChartComponent";
import PieChartComponent from "./PieChartComponent";
import AlumniTrendsChart from "@/components/dashboard/AlumniTrendsChart";
import type { AlumniTrendPoint } from "@/services/dashboardService";

const moduleLabel: Record<Exclude<AnalyticsModule, "dashboard">, string> = {
  alumni: "Alumni (All)",
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

  const isDashboard = module === "dashboard";
  const isAlumniModule = module === "alumni";
  const q = useAnalytics({ module, period }, !isAlumniModule);
  const data = q.data as any;

  const [alumniSummary, setAlumniSummary] = useState<{ total: number; growth: number } | null>(null);
  const [alumniSummaryLoading, setAlumniSummaryLoading] = useState(false);
  const [alumniSummaryError, setAlumniSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAlumniModule) {
      setAlumniSummary(null);
      setAlumniSummaryError(null);
      setAlumniSummaryLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setAlumniSummaryLoading(true);
      setAlumniSummaryError(null);
      try {
        const params = new URLSearchParams();
        params.set("period", period);
        const res = await fetch(`/api/dashboard/alumni-trends?${params.toString()}`);
        const json = (await res.json()) as AlumniTrendPoint[];
        if (!res.ok) {
          throw new Error((json as any)?.error || "Failed to load alumni trends");
        }
        if (!cancelled) {
          const normalized = json.map((p) => ({
            total: Number(p.total ?? 0),
          }));
          const total = normalized.reduce((acc, p) => acc + p.total, 0);
          const last = normalized[normalized.length - 1]?.total ?? 0;
          const prev = normalized[normalized.length - 2]?.total ?? 0;
          const growth = prev > 0 ? ((last - prev) / prev) * 100 : 0;
          setAlumniSummary({ total, growth });
        }
      } catch (e) {
        if (!cancelled) {
          setAlumniSummaryError(e instanceof Error ? e.message : "Failed to load alumni trends");
        }
      } finally {
        if (!cancelled) {
          setAlumniSummaryLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAlumniModule, period]);

  const topModule = useMemo(() => {
    if (!isDashboard) return null;
    const d = data as DashboardAnalytics | undefined;
    const list = d?.moduleTotals ?? [];

    // For the dashboard, we only care about Alumni (All) as the top module.
    const alumniEntry = list.find((m) => m.module === "alumni");
    if (!alumniEntry) return null;

    const label = moduleLabel[alumniEntry.module] ?? alumniEntry.module;
    return {
      label,
      total: Number(alumniEntry.total ?? 0),
      growth: Number(alumniEntry.growth ?? 0),
    };
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

      {(!isAlumniModule && q.isLoading) || (isAlumniModule && alumniSummaryLoading) ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <LoadingSpinner />
            Loading analytics…
          </div>
        </div>
      ) : (!isAlumniModule && q.isError) || (isAlumniModule && alumniSummaryError) ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">Failed to load analytics</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isAlumniModule ? alumniSummaryError : String((q.error as any)?.message || "Unknown error")}
          </p>
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
          <SummaryCards
            total={isAlumniModule ? Number(alumniSummary?.total ?? 0) : Number(data?.total ?? 0)}
            growth={isAlumniModule ? Number(alumniSummary?.growth ?? 0) : Number(data?.growth ?? 0)}
            topModule={isAlumniModule ? null : topModule}
          />

          {isAlumniModule ? (
            <AlumniTrendsChart period={period} />
          ) : (
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
          )}

          {isDashboard ? (
            <PieChartComponent
              title="Distribution"
              subtitle="Total by module (current period window)"
              labels={pie.labels}
              data={pie.series}
            />
          ) : null}

          {isDashboard && !isAlumniModule ? <AlumniTrendsChart period={period} /> : null}

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

