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
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { AnalyticsChartRenderer } from "@/components/analytics/v2/charts/AnalyticsChartRenderer";
import { AnalyticsCard } from "../AnalyticsCard";
import { ExpandDrawer } from "../ExpandDrawer";
import { Sparkline } from "../charts/Sparkline";
import { Bar } from "../charts/Bar";
import { Donut } from "../charts/Donut";
import { Heatmap } from "../charts/Heatmap";
import { ProgressBars } from "../charts/ProgressBars";
import { useExpandable } from "../hooks/useExpandable";
import {
  mapCareerBenefits,
  mapDiscountsMerchants,
  mapEngagementActivities,
  mapEngagementsChapters,
  mapMeetupsEvents,
  mapMembershipsPerks,
  mapPublicationsSurveys,
} from "../data/mapPayloadToCards";
import {
  careerServicesChart,
  engagementActivitiesChart,
  membershipsChart,
  merchantPartnershipsChart,
  publicationsChart,
  scholarshipsChart,
} from "@/components/analytics/v2/utils/chartSeriesBuilders";

const CARD_IDS = {
  chapters: "engagements-chapters",
  career: "career-benefits",
  meetups: "meetups-events",
  activities: "engagement-activities",
  publications: "publications-surveys",
  memberships: "memberships-perks",
  merchants: "discounts-merchants",
} as const;

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

  const drawers: Record<string, { title: string; content: React.ReactNode }> = {
    [CARD_IDS.chapters]: {
      title: "Engagements & Chapters",
      content: (
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value", align: "right" },
          ]}
          rows={[
            { metric: "National chapters", value: chapters.national },
            { metric: "International chapters", value: chapters.international },
            { metric: "Members", value: chapters.members },
            { metric: "Meetups YTD", value: chapters.meetupsYtd },
          ].map((r) => ({ ...r, value: String(r.value) }))}
        />
      ),
    },
    [CARD_IDS.career]: {
      title: "Association & Career Benefits",
      content: (
        <div className="space-y-4">
          <AnalyticsChartRenderer
            group={{
              id: "career",
              label: "Career Services",
              items: [],
              ...careerServicesChart(data),
            }}
          />
          <AnalyticsChartRenderer
            group={{
              id: "scholarships",
              label: "Scholarships",
              items: [],
              ...scholarshipsChart(data),
            }}
          />
        </div>
      ),
    },
    [CARD_IDS.meetups]: {
      title: "Meetups & Chapter Events",
      content: (
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "metric", label: "Metric" },
            { key: "value", label: "Count", align: "right" },
          ]}
          rows={[
            { metric: "Meetups (total)", value: String(meetups.meetupsTotal) },
            { metric: "Meetups YTD", value: String(meetups.meetupsYtd) },
            { metric: "Chapter events (total)", value: String(meetups.chapterEventsTotal) },
            { metric: "Chapter events YTD", value: String(meetups.chapterEventsYtd) },
          ]}
        />
      ),
    },
    [CARD_IDS.activities]: {
      title: "Engagement Activities",
      content: (
        <AnalyticsChartRenderer
          group={{
            id: "activities",
            label: "Activities",
            items: [],
            ...engagementActivitiesChart(data),
          }}
        />
      ),
    },
    [CARD_IDS.publications]: {
      title: "Publications & Surveys",
      content: (
        <AnalyticsChartRenderer
          group={{
            id: "publications",
            label: "Publications",
            items: [],
            ...publicationsChart(data),
          }}
        />
      ),
    },
    [CARD_IDS.memberships]: {
      title: "Memberships & Perks",
      content: (
        <AnalyticsChartRenderer
          group={{
            id: "memberships",
            label: "Memberships",
            items: [],
            ...membershipsChart(data),
          }}
        />
      ),
    },
    [CARD_IDS.merchants]: {
      title: "Discounts & Merchants",
      content: (
        <div className="space-y-4">
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "merchant", label: "Merchant" },
              { key: "discount", label: "Discount" },
              { key: "reference", label: "Reference" },
            ]}
            rows={discounts.merchants.map((m) => ({
              merchant: m.merchant,
              discount: m.discount,
              reference: m.reference,
            }))}
          />
          <AnalyticsChartRenderer
            group={{
              id: "merchants",
              label: "Partners",
              items: [],
              ...merchantPartnershipsChart(data),
            }}
          />
        </div>
      ),
    },
  };

  const active = activeId ? drawers[activeId] : null;
  const jobsPosted = career.kpis?.jobsPosted ?? 0;

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-2 grid-rows-4 gap-2 overflow-hidden">
        <AnalyticsCard
          id={CARD_IDS.chapters}
          title="Engagements & Chapters"
          icon={Users}
          accent="violet"
          primaryValue={chapters.national + chapters.international}
          secondaryLabel={`${chapters.members.toLocaleString()} members`}
          colSpan="col-span-2 row-span-1"
          delay={0.3}
          onExpand={open}
          chart={
            <Sparkline
              data={[chapters.meetupsYtd, chapters.meetupsYtd * 0.7, chapters.meetupsYtd * 0.85, chapters.meetupsYtd]}
              color="#a78bfa"
              height={44}
            />
          }
        />
        <AnalyticsCard
          id={CARD_IDS.career}
          title="Career Benefits"
          icon={Handshake}
          accent="violet"
          primaryValue={jobsPosted}
          secondaryLabel="Jobs posted"
          colSpan="col-span-1 row-span-1"
          delay={0.35}
          compact
          onExpand={open}
          chart={<Bar data={career.chart.chartSeries.slice(0, 3)} height={48} horizontal />}
        />
        <AnalyticsCard
          id={CARD_IDS.meetups}
          title="Meetups & Events"
          icon={Calendar}
          accent="violet"
          primaryValue={meetups.meetupsTotal}
          secondaryLabel={`${meetups.chapterEventsTotal} chapter events`}
          colSpan="col-span-1 row-span-1"
          delay={0.4}
          compact
          onExpand={open}
          chart={<Heatmap data={meetups.heatmapSeries} height={44} />}
        />
        <AnalyticsCard
          id={CARD_IDS.activities}
          title="Engagement Activities"
          icon={BookOpen}
          accent="violet"
          primaryValue={activities.rows.reduce((s, r) => s + r.ytd, 0)}
          secondaryLabel="YTD total"
          colSpan="col-span-2 row-span-1"
          delay={0.45}
          onExpand={open}
          chart={<Bar data={activities.chartSeries.slice(0, 3)} height={44} horizontal />}
        />
        <AnalyticsCard
          id={CARD_IDS.publications}
          title="Publications & Surveys"
          icon={Newspaper}
          accent="violet"
          primaryValue={publications.stories}
          secondaryLabel={`${publications.surveys} surveys`}
          colSpan="col-span-1 row-span-1"
          delay={0.5}
          compact
          onExpand={open}
          chart={<Bar data={publications.chartSeries} height={44} />}
        />
        <AnalyticsCard
          id={CARD_IDS.memberships}
          title="Memberships & Perks"
          icon={Gift}
          accent="violet"
          primaryValue={memberships.chartSeries.reduce((s, p) => s + p.value, 0)}
          secondaryLabel="Active perks"
          colSpan="col-span-1 row-span-1"
          delay={0.55}
          compact
          onExpand={open}
          chart={<ProgressBars data={memberships.chartSeries} maxItems={3} />}
        />
        <AnalyticsCard
          id={CARD_IDS.merchants}
          title="Discounts & Merchants"
          icon={Store}
          accent="violet"
          primaryValue={discounts.merchants.length}
          secondaryLabel="Partner merchants"
          colSpan="col-span-2 row-span-1"
          delay={0.6}
          onExpand={open}
          chart={<Donut data={discounts.discountSeries} size={48} />}
        />
      </div>

      <ExpandDrawer open={!!active} title={active?.title ?? ""} onClose={close} accent="violet">
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
