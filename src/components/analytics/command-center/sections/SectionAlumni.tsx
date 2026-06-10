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
import { CategoriesExpandPanel } from "../panels/CategoriesExpandPanel";
import { HonorExpandPanel } from "../panels/HonorExpandPanel";
import { LocationExpandPanel } from "../panels/LocationExpandPanel";
import { OccupationExpandPanel } from "../panels/OccupationExpandPanel";
import { OverviewExpandPanel } from "../panels/OverviewExpandPanel";
import { VelocityExpandPanel } from "../panels/VelocityExpandPanel";
import { AnalyticsCard } from "../AnalyticsCard";
import { ExpandDrawer } from "../ExpandDrawer";
import { MasonryGrid } from "../MasonryGrid";
import { Bar } from "../charts/Bar";
import { Donut } from "../charts/Donut";
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
  mapTransitionVelocity,
} from "../data/mapPayloadToCards";

const CARD_IDS = {
  overview: "alumni-overview",
  categories: "alumni-categories",
  occupation: "alumni-occupation",
  honor: "honor-cards",
  velocity: "transition-velocity",
  location: "location",
} as const;

const VERIFIED_ONLY = { verifiedOnly: true } as const;

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
  const categories = mapAlumniCategories(data, VERIFIED_ONLY);
  const occupation = mapAlumniOccupation(data, VERIFIED_ONLY);
  const honor = mapHonorCards(data, VERIFIED_ONLY);
  const velocity = mapTransitionVelocity(data, VERIFIED_ONLY);
  const location = mapLocation(data, VERIFIED_ONLY);
  const totalCategories = categories.rows.reduce((s, r) => s + r.count, 0);

  const WIDE_DRAWER_IDS = new Set<string>([
    CARD_IDS.overview,
    CARD_IDS.categories,
    CARD_IDS.occupation,
    CARD_IDS.honor,
    CARD_IDS.velocity,
    CARD_IDS.location,
  ]);

  const drawers: Record<string, { title: string; content: React.ReactNode }> = {
    [CARD_IDS.overview]: {
      title: "Alumni Overview",
      content: <OverviewExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.categories]: {
      title: "Alumni Categories (Verified)",
      content: <CategoriesExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.occupation]: {
      title: "Alumni Occupation (Verified)",
      content: <OccupationExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.honor]: {
      title: "Honor Cards (Verified)",
      content: <HonorExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.velocity]: {
      title: "Transition Velocity (Verified)",
      content: <VelocityExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.location]: {
      title: "Location Distribution (Verified)",
      content: <LocationExpandPanel data={data} isLoading={isLoading} />,
    },
  };

  const active = activeId ? drawers[activeId] : null;

  return (
    <>
      <MasonryGrid columns="default" layout="uniform">
        <AnalyticsCard
          id={CARD_IDS.overview}
          title="Alumni Overview"
          icon={GraduationCap}
          accent="emerald"
          primaryValue={overview.primaryValue}
          secondaryLabel={overview.secondaryLabel}
          masonrySize="lg"
          chartFill
          delay={0}
          onExpand={open}
          chart={
            <FillChart minHeight={120}>
              {(h) => (
                <Bar data={overview.headlineBars} height={h} horizontal={false} showLabels />
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
          secondaryLabel="Verified · A+ through D"
          masonrySize="lg"
          chartFill
          delay={0.05}
          onExpand={open}
          chart={
            <FillChart minHeight={120}>
              {() => (
                <Donut
                  data={categories.chartSeries}
                  showLabels
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
          primaryValue={occupation.rows.reduce((s, r) => s + r.count, 0).toLocaleString()}
          secondaryLabel="Verified · employed"
          masonrySize="lg"
          chartFill
          delay={0.1}
          onExpand={open}
          chart={
            <FillChart minHeight={120}>
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
          secondaryLabel={`Verified · ${honor.total.toLocaleString()} cards`}
          masonrySize="md"
          delay={0.15}
          onExpand={open}
          chart={
            <FillChart minHeight={72}>
              {(h) => (
                <Bar
                  data={honor.chartSeries.filter((p) => p.value > 0).slice(0, 4)}
                  height={h}
                  horizontal={false}
                  showLabels
                />
              )}
            </FillChart>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.velocity}
          title="Transition Velocity"
          icon={GaugeIcon}
          accent="emerald"
          primaryValue={`${velocity.score}%`}
          secondaryLabel="Verified · early transition"
          masonrySize="md"
          delay={0.2}
          onExpand={open}
          chart={
            <FillChart minHeight={72}>
              {(h) => <Gauge score={velocity.score} size={Math.min(96, Math.round(h * 0.85))} />}
            </FillChart>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.location}
          title="Location Distribution"
          icon={MapPin}
          accent="emerald"
          primaryValue={location.rows.reduce((s, r) => s + r.count, 0)}
          secondaryLabel="Verified · top provinces"
          masonrySize="md"
          delay={0.25}
          onExpand={open}
          chart={
            <FillChart minHeight={72}>
              {(h) => (
                <Bar
                  data={location.chartSeries.slice(0, 4)}
                  height={h}
                  horizontal={false}
                  showLabels
                />
              )}
            </FillChart>
          }
        />
      </MasonryGrid>

      <ExpandDrawer
        open={!!active}
        title={active?.title ?? ""}
        onClose={close}
        accent="emerald"
        maxWidthClass={activeId && WIDE_DRAWER_IDS.has(activeId) ? "max-w-5xl" : "max-w-3xl"}
      >
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
