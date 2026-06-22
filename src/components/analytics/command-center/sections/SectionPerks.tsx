"use client";

import React from "react";
import {
  BookOpen,
  Calendar,
  Gift,
  Handshake,
  Newspaper,
  Store,
  Users,
} from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { AnalyticsCard } from "../AnalyticsCard";
import { ExpandDrawer } from "../ExpandDrawer";
import { MasonryGrid } from "../MasonryGrid";
import { ChaptersCardChart } from "../charts/ChaptersCardChart";
import { FillChart } from "../charts/FillChart";
import { ActivitiesCardChart } from "../charts/ActivitiesCardChart";
import { MembershipsCardChart } from "../charts/MembershipsCardChart";
import { CareerCardChart } from "../charts/CareerCardChart";
import { DiscountsMerchantsCardChart } from "../charts/DiscountsMerchantsCardChart";
import { MeetupsEventsCardChart } from "../charts/MeetupsEventsCardChart";
import { PublicationsCardChart } from "../charts/PublicationsCardChart";
import { staggerDelay } from "../animation/useStaggeredEntrance";
import { useExpandable } from "../hooks/useExpandable";
import { ccPerksSubsection, ccPerksSubsectionHeader, ccSectionLabel } from "../theme";
import {
  mapCareerBenefits,
  mapDiscountsMerchants,
  mapEngagementActivities,
  mapEngagementsChapters,
  mapMeetupsEvents,
  mapMembershipsPerks,
  mapPublicationsSurveys,
} from "../data/mapPayloadToCards";
import { ChaptersExpandPanel } from "../panels/ChaptersExpandPanel";
import { ActivitiesExpandPanel } from "../panels/ActivitiesExpandPanel";
import { MembershipsExpandPanel } from "../panels/MembershipsExpandPanel";
import { CareerExpandPanel } from "../panels/CareerExpandPanel";
import { DiscountsMerchantsExpandPanel } from "../panels/DiscountsMerchantsExpandPanel";
import { MeetupsEventsExpandPanel } from "../panels/MeetupsEventsExpandPanel";
import { PublicationsExpandPanel } from "../panels/PublicationsExpandPanel";

const CARD_IDS = {
  chapters: "engagements-chapters",
  career: "career-benefits",
  meetups: "meetups-events",
  activities: "engagement-activities",
  publications: "publications-surveys",
  memberships: "memberships-perks",
  merchants: "discounts-merchants",
} as const;

const WIDE_DRAWER_IDS = new Set<string>([
  CARD_IDS.chapters,
  CARD_IDS.meetups,
  CARD_IDS.career,
  CARD_IDS.activities,
  CARD_IDS.publications,
  CARD_IDS.memberships,
  CARD_IDS.merchants,
]);

export function SectionPerks({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const { activeId, open, close } = useExpandable();
  const chapters = mapEngagementsChapters(data);
  const career = mapCareerBenefits(data);
  const meetups = mapMeetupsEvents(data);
  const activities = mapEngagementActivities(data);
  const publications = mapPublicationsSurveys(data);
  const memberships = mapMembershipsPerks(data);
  const discounts = mapDiscountsMerchants(data);

  const discountSummaryParts = discounts.categories
    .filter((c) => c.value > 0)
    .map((c) => `${c.value} ${c.label.toLowerCase()}`);
  if (discounts.merchantCount > 0) {
    discountSummaryParts.push(`${discounts.merchantCount} merchants`);
  }
  const discountSummary =
    discountSummaryParts.length > 0
      ? discountSummaryParts.join(" · ")
      : "No discounts or merchants yet";

  const drawers: Record<string, { title: string; content: React.ReactNode }> = {
    [CARD_IDS.chapters]: {
      title: "Chapters",
      content: <ChaptersExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.career]: {
      title: "Career Support",
      content: <CareerExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.meetups]: {
      title: "Meetups & Events",
      content: <MeetupsEventsExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.activities]: {
      title: "Engagement Activities",
      content: <ActivitiesExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.publications]: {
      title: "Publications & Surveys",
      content: <PublicationsExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.memberships]: {
      title: "Memberships & Perks",
      content: <MembershipsExpandPanel data={data} isLoading={isLoading} />,
    },
    [CARD_IDS.merchants]: {
      title: "Discounts & Merchants",
      content: <DiscountsMerchantsExpandPanel data={data} isLoading={isLoading} />,
    },
  };

  const active = activeId ? drawers[activeId] : null;
  const jobsTotal = career.jobs.total;

  const activityTotal = activities.ytdTotal;
  const perksTotal = memberships.totalApproved;
  return (
    <>
      <div className="space-y-3 font-sans antialiased lg:space-y-2.5">
        {/* Engagements */}
        <section aria-label="Engagements" className={ccPerksSubsection}>
          <h3 className={`${ccPerksSubsectionHeader} ${ccSectionLabel}`}>Engagements</h3>
          <MasonryGrid columns="narrow" layout="uniform" className="gap-2 lg:gap-1.5">
            <AnalyticsCard
              id={CARD_IDS.chapters}
              title="Chapters"
              icon={Users}
              accent="violet"
              variant="premium"
              primaryValue={chapters.national + chapters.international}
              secondaryLabel={`${chapters.national.toLocaleString()} national · ${chapters.international.toLocaleString()} international`}
              masonrySize="md"
              chartFill
              delay={staggerDelay(0, 0)}
              onExpand={open}
              chart={
                <FillChart minHeight={80}>
                  {(h) => (
                    <ChaptersCardChart
                      national={chapters.summaryChart.national}
                      international={chapters.summaryChart.international}
                      height={h}
                    />
                  )}
                </FillChart>
              }
            />
            <AnalyticsCard
              id={CARD_IDS.meetups}
              title="Meetups & Events"
              icon={Calendar}
              accent="violet"
              variant="premium"
              primaryValue={meetups.events.total + meetups.meetups.total}
              secondaryLabel={`${meetups.events.quarter} ${meetups.events.quarter === 1 ? "event" : "events"} · ${meetups.meetups.quarter} ${meetups.meetups.quarter === 1 ? "meetup" : "meetups"} (${meetups.quarterLabel})`}
              masonrySize="md"
              chartFill
              delay={staggerDelay(1, 0)}
              onExpand={open}
              chart={
                <MeetupsEventsCardChart
                  events={meetups.events}
                  meetups={meetups.meetups}
                  quarterLabel={meetups.quarterLabel}
                />
              }
            />
            <AnalyticsCard
              id={CARD_IDS.activities}
              title="Engagement Activities"
              icon={BookOpen}
              accent="violet"
              variant="premium"
              primaryValue={activityTotal}
              secondaryLabel={
                activityTotal > 0
                  ? `${activities.quarterTotal} this quarter · top: ${activities.topByYtd.activity}`
                  : `No activities (${activities.quarterLabel})`
              }
              masonrySize="md"
              chartFill
              delay={staggerDelay(2, 0)}
              emptyIdle
              onExpand={open}
              chart={
                <ActivitiesCardChart
                  quarterTotal={activities.quarterTotal}
                  ytdTotal={activities.ytdTotal}
                  quarterLabel={activities.quarterLabel}
                  topRows={activities.topRows}
                />
              }
            />
          </MasonryGrid>
        </section>

        {/* Perks */}
        <section aria-label="Perks & Benefits" className={ccPerksSubsection}>
          <h3 className={`${ccPerksSubsectionHeader} ${ccSectionLabel}`}>Perks</h3>
          <MasonryGrid columns="narrow" layout="uniform" className="gap-2 lg:gap-1.5">
            <AnalyticsCard
              id={CARD_IDS.memberships}
              title="Memberships & Perks"
              icon={Gift}
              accent="violet"
              variant="premium"
              primaryValue={perksTotal}
              secondaryLabel={`${memberships.total} Applications`}
              masonrySize="md"
              chartFill
              delay={staggerDelay(0, 0.16)}
              onExpand={open}
              chart={
                <MembershipsCardChart
                  gymApproved={memberships.gymApproved}
                  gymApplied={memberships.gymApplied}
                  poolApproved={memberships.poolApproved}
                  poolApplied={memberships.poolApplied}
                  qalanderApproved={memberships.qalanderApproved}
                  qalanderApplied={memberships.qalanderApplied}
                />
              }
            />
            <AnalyticsCard
              id={CARD_IDS.career}
              title="Career Support"
              icon={Handshake}
              accent="violet"
              variant="premium"
              primaryValue={jobsTotal}
              secondaryLabel={`${career.jobs.uol} UOL this Q`}
              masonrySize="md"
              chartFill
              delay={staggerDelay(1, 0.16)}
              onExpand={open}
              chart={
                <CareerCardChart
                  total={career.jobs.total}
                  uol={career.jobs.uol}
                  other={career.jobs.other}
                  quarter={career.jobs.quarter}
                  quarterLabel={career.quarterLabel}
                />
              }
            />
            <AnalyticsCard
              id={CARD_IDS.merchants}
              title="Discounts & Merchants"
              icon={Store}
              accent="violet"
              variant="premium"
              primaryValue={discounts.total}
              secondaryLabel={discountSummary}
              masonrySize="md"
              chartFill
              delay={staggerDelay(2, 0.16)}
              onExpand={open}
              chart={
                <DiscountsMerchantsCardChart
                  total={discounts.total}
                  dining={discounts.dining}
                  retail={discounts.retail}
                  travel={discounts.travel}
                  health={discounts.health}
                  professional={discounts.professional}
                  financial={discounts.financial}
                  merchantCount={discounts.merchantCount}
                />
              }
            />
          </MasonryGrid>
        </section>

        {/* Publications */}
        <section aria-label="Publications" className={ccPerksSubsection}>
          <h3 className={`${ccPerksSubsectionHeader} ${ccSectionLabel}`}>Publications</h3>
          <MasonryGrid columns="narrow" layout="uniform" className="gap-2 lg:gap-1.5">
            <AnalyticsCard
              id={CARD_IDS.publications}
              title="Publications & Surveys"
              icon={Newspaper}
              accent="violet"
              variant="premium"
              primaryValue={publications.stories}
              secondaryLabel={`${publications.newsletters} newsletters`}
              masonrySize="md"
              chartFill
              delay={staggerDelay(0, 0.08)}
              onExpand={open}
              chart={
                <PublicationsCardChart
                  stories={publications.stories}
                  storiesQuarter={publications.storiesQuarter}
                  newsletters={publications.newsletters}
                  surveys={publications.surveys}
                  quarterLabel={publications.quarterLabel}
                />
              }
            />
          </MasonryGrid>
        </section>
      </div>

      <ExpandDrawer
        open={!!active}
        title={active?.title ?? ""}
        onClose={close}
        accent="violet"
        maxWidthClass={activeId && WIDE_DRAWER_IDS.has(activeId) ? "max-w-5xl" : "max-w-3xl"}
      >
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
