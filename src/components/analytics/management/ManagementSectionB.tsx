"use client";

import React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionB } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import PieChartComponent from "@/components/analytics/PieChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";
import { AnalyticsPanel, AnalyticsSubheading, ChartInsight } from "@/components/analytics/v2/layout/AnalyticsPanel";
import { AnalyticsGrid, AnalyticsGridItem } from "@/components/analytics/v2/layout/AnalyticsGrid";
import { CompactMetricChip, MetricChipRow } from "@/components/analytics/v2/primitives/CompactMetricChip";
import { getPeriodColumnLabels } from "@/components/analytics/v2/utils/periodColumnLabels";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
};

const CHART_PROPS = { compact: true, height: 150 } as const;

export default function ManagementSectionB({ data, isLoading }: Props) {
  const { primary: periodPrimary, secondary: periodSecondary, periodLabel } = getPeriodColumnLabels(data);
  const b = data?.sectionB;
  const chapterStats: Partial<ManagementDashboardSectionB["chaptersAssociations"]> = b?.chaptersAssociations ?? {};
  const chapterEventsSource = b?.activities?.chapterEvents;
  const cardsStatus: Partial<ManagementDashboardSectionB["cardsStatus"]> = b?.cardsStatus ?? {};
  const activitySource: Partial<ManagementDashboardSectionB["activities"]> = b?.activities ?? {};
  const pubs: Partial<ManagementDashboardSectionB["publications"]> = b?.publications ?? {};

  const engagementActivityRows = [
    { activity: "Mentorship Sessions", quarter: fmtCell(activitySource.mentorshipSessions?.quarter), ytd: fmtCell(activitySource.mentorshipSessions?.ytd) },
    { activity: "Seminars Participation", quarter: fmtCell(activitySource.seminarsParticipation?.quarter), ytd: fmtCell(activitySource.seminarsParticipation?.ytd) },
    { activity: "Conferences Participation", quarter: fmtCell(activitySource.conferencesParticipation?.quarter), ytd: fmtCell(activitySource.conferencesParticipation?.ytd) },
    { activity: "Alumni Talks", quarter: fmtCell(activitySource.alumniTalks?.quarter), ytd: fmtCell(activitySource.alumniTalks?.ytd) },
    { activity: "High Achievers Recognition", quarter: fmtCell(activitySource.highAchieversRecognition?.quarter), ytd: fmtCell(activitySource.highAchieversRecognition?.ytd) },
    { activity: "Wellbeing Support", quarter: fmtCell(activitySource.wellbeingSupport?.quarter), ytd: fmtCell(activitySource.wellbeingSupport?.ytd) },
  ];
  const actLabels = engagementActivityRows.map((r) => r.activity);
  const actQuarter = engagementActivityRows.map((r) => (typeof r.quarter === "number" ? r.quarter : 0));
  const topActivity = [...engagementActivityRows].sort((x, y) => (Number(y.quarter) || 0) - (Number(x.quarter) || 0))[0];

  const honorLabels = ["Applied", "Review", "On-hold", "Printing", "Ready", "Delivered"];
  const honorData = [
    typeof cardsStatus.applied === "number" ? cardsStatus.applied : 0,
    typeof cardsStatus.review === "number" ? cardsStatus.review : 0,
    typeof cardsStatus.onHold === "number" ? cardsStatus.onHold : 0,
    typeof cardsStatus.underPrinting === "number" ? cardsStatus.underPrinting : 0,
    typeof cardsStatus.readyForDelivery === "number" ? cardsStatus.readyForDelivery : 0,
    typeof cardsStatus.delivered === "number" ? cardsStatus.delivered : 0,
  ];

  const pubRows = [
    { metric: "Success stories (website)", total: fmtCell(pubs.successStoriesPublished), q: fmtCell(pubs.successStoriesQuarter), y: fmtCell(pubs.successStoriesYtd) },
    { metric: "Newsletters issued", total: fmtCell(pubs.newslettersIssued), q: fmtCell(pubs.newslettersQuarter), y: fmtCell(pubs.newslettersYtd) },
    { metric: "Surveys conducted", total: fmtCell(pubs.surveysConducted), q: "—", y: "—" },
  ];

  return (
    <AnalyticsPanel
      id="section-b"
      title="Engagement & Chapters"
      subtitle="Chapters, honor cards, activities, and publications"
      icon={DashboardIcons.users}
      className="mt-3"
    >
      <div className="space-y-3">
        <div>
          <AnalyticsSubheading>Chapters & associations</AnalyticsSubheading>
          <ChartInsight>Org-wide chapter and meetup totals (see scope notes)</ChartInsight>
          <MetricChipRow className="mb-2">
            <CompactMetricChip label="National" value={fmtCell(chapterStats.nationalChapters)} color="indigo" />
            <CompactMetricChip label="International" value={fmtCell(chapterStats.internationalChapters)} color="emerald" />
            <CompactMetricChip label="Associations" value={fmtCell(chapterStats.associationMembers)} color="amber" hint={`${fmtCell(chapterStats.associations)} faculties`} />
            <CompactMetricChip label="Members" value={fmtCell(chapterStats.members)} color="sky" />
            <CompactMetricChip label="Leaders" value={fmtCell(chapterStats.leadersAppointed)} color="violet" />
            <CompactMetricChip label="Meetups" value={fmtCell(chapterStats.meetupsTotal)} hint={`${periodPrimary}: ${fmtCell(chapterStats.meetupsQuarter)} · ${periodSecondary}: ${fmtCell(chapterStats.meetupsYtd)}`} color="rose" />
          </MetricChipRow>
          <ChartTableToggle
            widgetId="mgmt-meetups"
            defaultView="table"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "metric", label: "Metric" },
                  { key: "quarter", label: periodPrimary, align: "right" },
                  { key: "ytd", label: periodSecondary, align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                rows={[
                  { metric: "Meetups", quarter: fmtCell(chapterStats.meetupsQuarter), ytd: fmtCell(chapterStats.meetupsYtd), total: fmtCell(chapterStats.meetupsTotal) },
                  { metric: "Chapter events", quarter: fmtCell(chapterEventsSource?.quarter), ytd: fmtCell(chapterEventsSource?.ytd), total: fmtCell(chapterEventsSource?.total) },
                ]}
              />
            }
            chart={
              <BarChartComponent
                title="Events & meetups"
                subtitle={`${periodPrimary} vs ${periodSecondary}`}
                labels={[`Meetups ${periodPrimary}`, `Meetups ${periodSecondary}`, `Chapter events ${periodPrimary}`, `Chapter events ${periodSecondary}`]}
                data={[
                  Number(chapterStats.meetupsQuarter ?? 0),
                  Number(chapterStats.meetupsYtd ?? 0),
                  Number(chapterEventsSource?.quarter ?? 0),
                  Number(chapterEventsSource?.ytd ?? 0),
                ]}
                {...CHART_PROPS}
              />
            }
          />
        </div>

        <AnalyticsGrid>
          <AnalyticsGridItem span={6}>
            <AnalyticsSubheading dotColor="bg-amber-500">Alumni honor cards status</AnalyticsSubheading>
            <MetricChipRow className="mb-2">
              <CompactMetricChip label="Applied" value={fmtCell(cardsStatus.applied)} color="slate" />
              <CompactMetricChip label="Under review" value={fmtCell(cardsStatus.review)} color="amber" />
              <CompactMetricChip label="On-hold" value={fmtCell(cardsStatus.onHold)} color="rose" />
              <CompactMetricChip label="Under printing" value={fmtCell(cardsStatus.underPrinting)} color="sky" />
              <CompactMetricChip label="Ready" value={fmtCell(cardsStatus.readyForDelivery)} color="indigo" />
              <CompactMetricChip label="Delivered" value={fmtCell(cardsStatus.delivered)} color="emerald" />
            </MetricChipRow>
            <ChartInsight>{typeof cardsStatus.delivered === "number" ? `${cardsStatus.delivered.toLocaleString()} cards delivered` : "—"}</ChartInsight>
            <ChartTableToggle
              widgetId="mgmt-honor-cards"
              defaultView="chart"
              table={
                <AnalyticsDataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "status", label: "Status" },
                    { key: "count", label: "Count", align: "right" },
                  ]}
                  rows={honorLabels.map((label, i) => ({ status: label, count: honorData[i] ?? "—" }))}
                />
              }
              chart={<PieChartComponent title="Honor card pipeline" labels={honorLabels} data={honorData} {...CHART_PROPS} />}
            />
          </AnalyticsGridItem>

          <AnalyticsGridItem span={6}>
            <AnalyticsSubheading dotColor="bg-emerald-500">Engagement activities</AnalyticsSubheading>
            <ChartInsight>{topActivity ? `Top in period: ${topActivity.activity} (${topActivity.quarter})` : "—"}</ChartInsight>
            <ChartTableToggle
              widgetId="mgmt-activities"
              defaultView="table"
              table={
                <AnalyticsDataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "activity", label: "Activity" },
                    { key: "quarter", label: periodPrimary, align: "right" },
                    { key: "ytd", label: periodSecondary, align: "right" },
                  ]}
                  rows={engagementActivityRows}
                />
              }
              chart={<BarChartComponent title={`Activities (${periodLabel})`} subtitle="Talks & programs" labels={actLabels} data={actQuarter} {...CHART_PROPS} />}
            />
          </AnalyticsGridItem>

          <AnalyticsGridItem span={12}>
            <AnalyticsSubheading dotColor="bg-violet-500">Publications, social & surveys</AnalyticsSubheading>
            <ChartTableToggle
              widgetId="mgmt-publications"
              defaultView="table"
              table={
                <AnalyticsDataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "metric", label: "Metric" },
                    { key: "total", label: "All-time / total", align: "right" },
                    { key: "q", label: periodPrimary, align: "right" },
                    { key: "y", label: periodSecondary, align: "right" },
                  ]}
                  rows={pubRows}
                />
              }
              chart={
                <BarChartComponent
                  title="Publications snapshot"
                  labels={["Success stories", "Newsletters", "Surveys"]}
                  data={[Number(pubs.successStoriesPublished ?? 0), Number(pubs.newslettersIssued ?? 0), Number(pubs.surveysConducted ?? 0)]}
                  {...CHART_PROPS}
                />
              }
            />
          </AnalyticsGridItem>
        </AnalyticsGrid>
      </div>
    </AnalyticsPanel>
  );
}
