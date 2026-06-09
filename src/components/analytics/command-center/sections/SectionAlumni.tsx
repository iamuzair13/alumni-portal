"use client";

import React from "react";
import {
  Award,
  Briefcase,
  Gauge as GaugeIcon,
  GraduationCap,
  Layers,
  MapPin,
} from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { AnalyticsChartRenderer } from "@/components/analytics/v2/charts/AnalyticsChartRenderer";
import { AnalyticsCard } from "../AnalyticsCard";
import { ExpandDrawer } from "../ExpandDrawer";
import { Sparkline } from "../charts/Sparkline";
import { Donut } from "../charts/Donut";
import { Bar } from "../charts/Bar";
import { Gauge } from "../charts/Gauge";
import { OccupationRadar } from "../charts/OccupationRadar";
import { FillChart } from "../charts/FillChart";
import { useExpandable } from "../hooks/useExpandable";
import {
  mapAlumniCategories,
  mapAlumniOccupation,
  mapAlumniOverview,
  mapHonorCards,
  mapLocation,
  mapSparklineData,
  mapTransitionVelocity,
} from "../data/mapPayloadToCards";
import {
  honorCardsChart,
  occupationChart,
  provinceLocationChart,
  transitionVelocityChart,
} from "@/components/analytics/v2/utils/chartSeriesBuilders";

const CARD_IDS = {
  overview: "alumni-overview",
  categories: "alumni-categories",
  occupation: "alumni-occupation",
  honor: "honor-cards",
  velocity: "transition-velocity",
  location: "location",
} as const;

export function SectionAlumni({
  data,
  trends,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  trends: AlumniTrendPoint[] | undefined;
  isLoading: boolean;
}) {
  const { activeId, open, close } = useExpandable();
  const overview = mapAlumniOverview(data);
  const categories = mapAlumniCategories(data);
  const occupation = mapAlumniOccupation(data);
  const honor = mapHonorCards(data);
  const velocity = mapTransitionVelocity(data);
  const location = mapLocation(data);
  const sparkline = mapSparklineData(trends);

  const totalCategories = categories.rows.reduce((s, r) => s + r.count, 0);

  const drawers: Record<string, { title: string; content: React.ReactNode }> = {
    [CARD_IDS.overview]: {
      title: "Alumni Overview",
      content: (
        <div className="space-y-4">
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "faculty", label: "Faculty" },
              { key: "registrations", label: "Registrations", align: "right" },
            ]}
            rows={overview.facultyRows.map((r) => ({
              faculty: r.faculty,
              registrations: r.registrations.toLocaleString(),
            }))}
          />
          <AnalyticsChartRenderer
            group={{
              id: "overview",
              label: "Overview",
              items: [],
              chartType: "bar",
              chartSeries: overview.chartSeries,
            }}
          />
        </div>
      ),
    },
    [CARD_IDS.categories]: {
      title: "Alumni Categories",
      content: (
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "tier", label: "Tier" },
            { key: "count", label: "Count", align: "right" },
            { key: "pct", label: "%", align: "right" },
          ]}
          rows={categories.rows.map((r) => ({
            tier: r.tier,
            count: r.count.toLocaleString(),
            pct: totalCategories > 0 ? `${((r.count / totalCategories) * 100).toFixed(1)}%` : "—",
          }))}
        />
      ),
    },
    [CARD_IDS.occupation]: {
      title: "Alumni Occupation",
      content: (
        <div className="space-y-4">
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "status", label: "Status" },
              { key: "count", label: "Count", align: "right" },
            ]}
            rows={occupation.rows.map((r) => ({
              status: r.status,
              count: r.count.toLocaleString(),
            }))}
          />
          <AnalyticsChartRenderer
            group={{
              id: "occupation",
              label: "Occupation",
              items: [],
              ...occupationChart(data),
            }}
          />
        </div>
      ),
    },
    [CARD_IDS.honor]: {
      title: "Alumni Honor Cards",
      content: (
        <AnalyticsChartRenderer
          group={{
            id: "honor",
            label: "Honor Cards",
            items: [],
            ...honorCardsChart(data),
          }}
        />
      ),
    },
    [CARD_IDS.velocity]: {
      title: "Transition Velocity",
      content: (
        <AnalyticsChartRenderer
          group={{
            id: "velocity",
            label: "Transition Velocity",
            items: [],
            ...transitionVelocityChart(
              data?.sectionA?.transitionVelocity,
              data?.alumniHeadline?.total ?? data?.kpis?.totalAlumni
            ),
          }}
        />
      ),
    },
    [CARD_IDS.location]: {
      title: "Location Distribution",
      content: (
        <div className="space-y-4">
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "region", label: "Region" },
              { key: "count", label: "Alumni", align: "right" },
            ]}
            rows={location.rows
              .filter((r) => r.count > 0)
              .map((r) => ({ region: r.region, count: r.count.toLocaleString() }))}
          />
          <AnalyticsChartRenderer
            group={{
              id: "location",
              label: "Location",
              items: [],
              ...provinceLocationChart(data),
            }}
          />
        </div>
      ),
    },
  };

  const active = activeId ? drawers[activeId] : null;

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-6 grid-rows-4 gap-2 overflow-hidden">
        <AnalyticsCard
          id={CARD_IDS.overview}
          title="Alumni Overview"
          icon={GraduationCap}
          accent="emerald"
          primaryValue={overview.primaryValue}
          secondaryLabel={overview.secondaryLabel}
          colSpan="col-span-3 row-span-2"
          chartFill
          delay={0}
          onExpand={open}
          chart={
            <FillChart minHeight={80}>
              {(h) => (
                <div className="flex h-full min-h-0 gap-2">
                  <div className="h-full min-w-0 flex-[3]">
                    <Sparkline data={sparkline} color="#34d399" height={h} />
                  </div>
                  <div className="flex h-full min-w-0 flex-[2]">
                    <Donut
                      showLabels
                      showLegend
                      minSlicePercent={0.04}
                      data={[
                        { label: "Active", value: data?.kpis?.activeAlumni ?? 0, color: "#34d399" },
                        {
                          label: "Inactive",
                          value: Math.max(
                            0,
                            (data?.kpis?.totalAlumni ?? 0) - (data?.kpis?.activeAlumni ?? 0)
                          ),
                          color: "#94a3b8",
                        },
                      ]}
                    />
                  </div>
                </div>
              )}
            </FillChart>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.categories}
          title="Categories"
          icon={Layers}
          accent="emerald"
          primaryValue={totalCategories}
          secondaryLabel="A+ through D tiers"
          colSpan="col-span-1 row-span-2"
          chartFill
          delay={0.05}
          compact
          onExpand={open}
          chart={
            <FillChart minHeight={80}>
              {() => (
                <Donut
                  data={categories.chartSeries}
                  showLegend
                  minSlicePercent={0.05}
                />
              )}
            </FillChart>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.occupation}
          title="Occupation"
          icon={Briefcase}
          accent="emerald"
          primaryValue={occupation.rows[0]?.count ?? 0}
          secondaryLabel="Employed alumni"
          colSpan="col-span-2 row-span-2"
          chartFill
          delay={0.1}
          onExpand={open}
          chart={
            <FillChart minHeight={80}>
              {(h) => <OccupationRadar data={occupation.chartSeries} height={h} />}
            </FillChart>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.honor}
          title="Honor Cards"
          icon={Award}
          accent="emerald"
          primaryValue={honor.delivered}
          secondaryLabel={`${honor.total.toLocaleString()} total`}
          colSpan="col-span-1 row-span-1"
          delay={0.15}
          compact
          onExpand={open}
          chart={
            <div className="grid grid-cols-3 gap-1">
              {honor.badges.slice(0, 3).map((b) => (
                <div
                  key={b.label}
                  className="rounded-md bg-gray-100 px-1 py-1 text-center dark:bg-gray-800/80"
                >
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{b.label}</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{b.count}</div>
                </div>
              ))}
            </div>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.velocity}
          title="Transition Velocity"
          icon={GaugeIcon}
          accent="emerald"
          primaryValue={velocity.score}
          secondaryLabel="Early transition · all alumni"
          colSpan="col-span-1 row-span-1"
          delay={0.2}
          compact
          onExpand={open}
          chart={<Gauge score={velocity.score} size={44} />}
        />
        <AnalyticsCard
          id={CARD_IDS.location}
          title="Location Distribution"
          icon={MapPin}
          accent="emerald"
          primaryValue={location.rows.reduce((s, r) => s + r.count, 0)}
          secondaryLabel="By province / region"
          colSpan="col-span-4 row-span-1"
          delay={0.25}
          onExpand={open}
          chart={<Bar data={location.chartSeries.slice(0, 5)} height={52} horizontal />}
        />
      </div>

      <ExpandDrawer
        open={!!active}
        title={active?.title ?? ""}
        onClose={close}
        accent="emerald"
      >
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
