"use client";

import React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionB } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import PieChartComponent from "@/components/analytics/PieChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { SectionWrapper, StatCard, DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
};

export default function ManagementSectionB({ data, isLoading }: Props) {
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
    <div className="mt-6">
      <SectionWrapper
        id="section-b"
        title="Engagement & Networking"
        subtitle="Chapters, honor cards, activities, and publications"
        icon={DashboardIcons.users}
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Chapters & associations
            </h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Chapter and meetup totals are organization-wide (see scope notes in API).
            </p>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="National" value={fmtCell(chapterStats.nationalChapters)} color="indigo" />
              <StatCard label="International" value={fmtCell(chapterStats.internationalChapters)} color="emerald" />
              <StatCard label="Associations" value={fmtCell(chapterStats.associations)} color="amber" />
              <StatCard label="Members" value={fmtCell(chapterStats.members)} color="sky" />
              <StatCard label="Leaders" value={fmtCell(chapterStats.leadersAppointed)} color="violet" />
              <StatCard
                label="Meetups (total)"
                value={fmtCell(chapterStats.meetupsTotal)}
                hint={`Q: ${fmtCell(chapterStats.meetupsQuarter)} · YTD: ${fmtCell(chapterStats.meetupsYtd)}`}
                color="rose"
              />
            </div>
            <ChartTableToggle
              widgetId="mgmt-meetups"
              defaultView="table"
              table={
                <AnalyticsDataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "metric", label: "Metric" },
                    { key: "quarter", label: "This Quarter", align: "right" },
                    { key: "ytd", label: "YTD", align: "right" },
                    { key: "total", label: "Total", align: "right" },
                  ]}
                  rows={[
                    {
                      metric: "Meetups",
                      quarter: fmtCell(chapterStats.meetupsQuarter),
                      ytd: fmtCell(chapterStats.meetupsYtd),
                      total: fmtCell(chapterStats.meetupsTotal),
                    },
                    {
                      metric: "Chapter events",
                      quarter: fmtCell(chapterEventsSource?.quarter),
                      ytd: fmtCell(chapterEventsSource?.ytd),
                      total: fmtCell(chapterEventsSource?.total),
                    },
                  ]}
                />
              }
              chart={
                <BarChartComponent
                  title="Events & meetups"
                  subtitle="This quarter vs YTD (calendar)"
                  labels={["Meetups Q", "Meetups YTD", "Chapter events Q", "Chapter events YTD"]}
                  data={[
                    Number(chapterStats.meetupsQuarter ?? 0),
                    Number(chapterStats.meetupsYtd ?? 0),
                    Number(chapterEventsSource?.quarter ?? 0),
                    Number(chapterEventsSource?.ytd ?? 0),
                  ]}
                />
              }
            />
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Alumni honor cards status
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Applied" value={fmtCell(cardsStatus.applied)} color="slate" />
              <StatCard label="Under review" value={fmtCell(cardsStatus.review)} color="amber" />
              <StatCard label="On-hold" value={fmtCell(cardsStatus.onHold)} color="rose" />
              <StatCard label="Under printing" value={fmtCell(cardsStatus.underPrinting)} color="sky" />
              <StatCard label="Ready for delivery" value={fmtCell(cardsStatus.readyForDelivery)} color="indigo" />
              <StatCard label="Delivered" value={fmtCell(cardsStatus.delivered)} color="emerald" />
            </div>
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
              chart={<PieChartComponent title="Honor card pipeline" labels={honorLabels} data={honorData} />}
            />
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Engagement activities
            </h3>
            <ChartTableToggle
              widgetId="mgmt-activities"
              defaultView="table"
              table={
                <AnalyticsDataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "activity", label: "Activity" },
                    { key: "quarter", label: "This Quarter", align: "right" },
                    { key: "ytd", label: "YTD", align: "right" },
                  ]}
                  rows={engagementActivityRows}
                />
              }
              chart={<BarChartComponent title="Activities (this quarter)" subtitle="Counts from alumni talks & programs" labels={actLabels} data={actQuarter} />}
            />
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Publications, social & surveys
            </h3>
            <ChartTableToggle
              widgetId="mgmt-publications"
              defaultView="table"
              table={
                <AnalyticsDataTable
                  isLoading={isLoading}
                  columns={[
                    { key: "metric", label: "Metric" },
                    { key: "total", label: "All-time / total", align: "right" },
                    { key: "q", label: "This quarter", align: "right" },
                    { key: "y", label: "YTD", align: "right" },
                  ]}
                  rows={pubRows}
                />
              }
              chart={
                <BarChartComponent
                  title="Publications snapshot"
                  labels={["Success stories", "Newsletters", "Surveys"]}
                  data={[
                    Number(pubs.successStoriesPublished ?? 0),
                    Number(pubs.newslettersIssued ?? 0),
                    Number(pubs.surveysConducted ?? 0),
                  ]}
                />
              }
            />
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
