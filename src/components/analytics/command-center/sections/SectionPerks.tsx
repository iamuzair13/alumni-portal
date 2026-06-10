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
import { MasonryGrid } from "../MasonryGrid";
import { Sparkline } from "../charts/Sparkline";
import { Bar } from "../charts/Bar";
import { FillChart } from "../charts/FillChart";
import { Heatmap } from "../charts/Heatmap";
import { MetricChips } from "../charts/MetricChips";
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

  const activityTotal = activities.rows.reduce((s, r) => s + r.ytd, 0);
  const perksTotal = memberships.chartSeries.reduce((s, p) => s + p.value, 0);
  const chapterSpark = [
    chapters.meetupsYtd,
    Math.round(chapters.meetupsYtd * 0.72),
    Math.round(chapters.meetupsYtd * 0.88),
    chapters.meetupsYtd,
  ];

  return (
    <>
      <MasonryGrid columns="narrow" layout="uniform">
        <AnalyticsCard
          id={CARD_IDS.chapters}
          title="Engagements & Chapters"
          icon={Users}
          accent="violet"
          primaryValue={chapters.national + chapters.international}
          secondaryLabel={`${chapters.members.toLocaleString()} members`}
          masonrySize="md"
          chartFill
          delay={0.3}
          onExpand={open}
          chart={
            <FillChart minHeight={80}>
              {(h) => <Sparkline data={chapterSpark} color="#8b5cf6" height={h} />}
            </FillChart>
          }
        />
        <AnalyticsCard
          id={CARD_IDS.career}
          title="Career Benefits"
          icon={Handshake}
          accent="violet"
          primaryValue={jobsPosted}
          secondaryLabel="Jobs posted"
          masonrySize="md"
          delay={0.35}
          onExpand={open}
          chart={<MetricChips data={career.chart.chartSeries.slice(0, 3)} />}
        />
        <AnalyticsCard
          id={CARD_IDS.meetups}
          title="Meetups & Events"
          icon={Calendar}
          accent="violet"
          primaryValue={meetups.meetupsTotal}
          secondaryLabel={`${meetups.chapterEventsTotal} chapter events`}
          masonrySize="md"
          delay={0.4}
          onExpand={open}
          chart={<Heatmap data={meetups.heatmapSeries} />}
        />
        <AnalyticsCard
          id={CARD_IDS.activities}
          title="Engagement Activities"
          icon={BookOpen}
          accent="violet"
          primaryValue={activityTotal}
          secondaryLabel={
            activityTotal > 0 ? "YTD total" : "YTD total · No activities recorded yet"
          }
          masonrySize="md"
          chartFill={activityTotal > 0}
          delay={0.45}
          onExpand={open}
          chart={
            activityTotal > 0 ? (
              <FillChart minHeight={80}>
                {(h) => <Bar data={activities.chartSeries.slice(0, 4)} height={h} horizontal />}
              </FillChart>
            ) : undefined
          }
        />
        <AnalyticsCard
          id={CARD_IDS.publications}
          title="Publications & Surveys"
          icon={Newspaper}
          accent="violet"
          primaryValue={publications.stories}
          secondaryLabel={`${publications.surveys} surveys`}
          masonrySize="md"
          delay={0.5}
          onExpand={open}
          chart={
            <MetricChips
              data={[
                { label: "Stories", value: publications.stories },
                { label: "Surveys", value: publications.surveys },
                { label: "News", value: publications.newsletters },
              ]}
            />
          }
        />
        <AnalyticsCard
          id={CARD_IDS.memberships}
          title="Memberships & Perks"
          icon={Gift}
          accent="violet"
          primaryValue={perksTotal}
          secondaryLabel="Active perks"
          masonrySize="md"
          delay={0.55}
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
          masonrySize="md"
          delay={0.6}
          onExpand={open}
          chart={
            discounts.merchants.length > 0 ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1">
                {discounts.merchants.slice(0, 6).map((m) => (
                  <span
                    key={`${m.merchant}-${m.reference}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-200/80 bg-violet-50/80 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"
                    title={m.merchant}
                  >
                    <span className="truncate">{m.merchant}</span>
                    {m.discount ? (
                      <span className="shrink-0 rounded bg-violet-200/80 px-1 text-[9px] font-bold dark:bg-violet-500/30">
                        {m.discount}
                      </span>
                    ) : null}
                  </span>
                ))}
                {discounts.merchants.length > 6 ? (
                  <span className="shrink-0 text-[10px] font-semibold text-violet-600 dark:text-violet-300">
                    +{discounts.merchants.length - 6}
                  </span>
                ) : null}
              </div>
            ) : (
              <MetricChips
                data={discounts.discountSeries}
                emptyMessage="No partner merchants"
                variant="rows"
              />
            )
          }
        />
      </MasonryGrid>

      <ExpandDrawer open={!!active} title={active?.title ?? ""} onClose={close} accent="violet">
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
