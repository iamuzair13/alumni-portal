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
import { CategoriesCardChart } from "../charts/CategoriesCardChart";
import { OccupationCardChart } from "../charts/OccupationCardChart";
import { LocationCardChart } from "../charts/LocationCardChart";
import { VelocityCardChart } from "../charts/VelocityCardChart";
import { FillChart } from "../charts/FillChart";
import { staggerDelay } from "../animation/useStaggeredEntrance";
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
  const totalOccupation = occupation.rows.reduce((s, r) => s + r.count, 0);
  const totalLocation = location.rows.reduce((s, r) => s + r.count, 0);

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
      title: "Alumni",
      content: <OverviewExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.categories]: {
      title: "Alumni Categories",
      content: <CategoriesExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.occupation]: {
      title: "Alumni Occupation",
      content: <OccupationExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.honor]: {
      title: "Honor Cards",
      content: <HonorExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.velocity]: {
      title: "Transition Velocity",
      content: <VelocityExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.location]: {
      title: "Location Distribution",
      content: <LocationExpandPanel data={data} isLoading={isLoading} />,
    },
  };

  const active = activeId ? drawers[activeId] : null;

  return (
    <>
      <MasonryGrid columns="default" layout="uniform" className="gap-1.5">
        <AnalyticsCard
          id={CARD_IDS.overview}
          title="Alumni"
          icon={GraduationCap}
          accent="emerald"
          primaryValue={`Total - ${overview.primaryValue}`}
          secondaryLabel=''
          masonrySize="md"
          chartFill
          delay={staggerDelay(0)}
          onExpand={open}
          chart={
            <FillChart minHeight={88}>
              {(h) => (
                <Bar
                  data={overview.headlineBars.filter((p) => p.label !== "Total")}
                  height={h}
                  horizontal={false}
                  showLabels
                />
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
          secondaryLabel=""
          masonrySize="md"
          chartFill
          delay={staggerDelay(1)}
          onExpand={open}
          chart={<CategoriesCardChart rows={categories.rows} total={totalCategories} />}
        />
        <AnalyticsCard
          id={CARD_IDS.occupation}
          title="Occupation"
          icon={Briefcase}
          accent="emerald"
          primaryValue={totalOccupation}
          secondaryLabel=""
          masonrySize="md"
          chartFill
          delay={staggerDelay(2)}
          onExpand={open}
          chart={<OccupationCardChart rows={occupation.rows} total={totalOccupation} />}
        />
        <AnalyticsCard
          id={CARD_IDS.honor}
          title="Honor Cards"
          icon={Award}
          accent="emerald"
          primaryValue={honor.total}
          secondaryLabel={`Delivered · ${honor.delivered.toLocaleString()} cards`}
          masonrySize="sm"
          delay={staggerDelay(3)}
          onExpand={open}
          chart={
            <FillChart minHeight={56}>
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
          primaryValue={velocity.trackedTotal}
          secondaryLabel={`${velocity.buckets.beforeGraduation.toLocaleString()} during grad · ${velocity.score}% early`}
          masonrySize="sm"
          chartFill
          delay={staggerDelay(4)}
          onExpand={open}
          chart={<VelocityCardChart rows={velocity.rows} total={velocity.trackedTotal} />}
        />
        <AnalyticsCard
          id={CARD_IDS.location}
          title="Location Distribution"
          icon={MapPin}
          accent="emerald"
          primaryValue={totalLocation}
          secondaryLabel="Top provinces"
          masonrySize="sm"
          chartFill
          delay={staggerDelay(5)}
          onExpand={open}
          chart={<LocationCardChart rows={location.rows} total={totalLocation} />}
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
