"use client";

import React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionC } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";
import { AnalyticsPanel, AnalyticsSubheading, ChartInsight } from "@/components/analytics/v2/layout/AnalyticsPanel";
import { AnalyticsGrid, AnalyticsGridItem } from "@/components/analytics/v2/layout/AnalyticsGrid";
import { getPeriodColumnLabels } from "@/components/analytics/v2/utils/periodColumnLabels";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
};

const CHART_PROPS = { compact: true, height: 150 } as const;

export default function ManagementSectionC({ data, isLoading }: Props) {
  const { primary: periodPrimary, secondary: periodSecondary, periodLabel } = getPeriodColumnLabels(data);
  const c = data?.sectionC;
  const careerSource: Partial<ManagementDashboardSectionC["career"]> = c?.career ?? {};
  const scholarshipSource: Partial<ManagementDashboardSectionC["scholarships"]> = c?.scholarships ?? {};
  const giveBack = c?.giveBackFinancialAssistance;

  const careerRows = [
    { item: "Recruitment Drives", quarter: fmtCell(careerSource.recruitmentDrives?.quarter), ytd: fmtCell(careerSource.recruitmentDrives?.ytd) },
    { item: "Jobs Posted (UOL)", quarter: fmtCell(careerSource.jobsPostedUol?.quarter), ytd: fmtCell(careerSource.jobsPostedUol?.ytd) },
    { item: "Jobs Posted (Other)", quarter: fmtCell(careerSource.jobsPostedOtherEmployers?.quarter), ytd: fmtCell(careerSource.jobsPostedOtherEmployers?.ytd) },
    { item: "Startups Support", quarter: fmtCell(careerSource.startupsSupport?.quarter), ytd: fmtCell(careerSource.startupsSupport?.ytd) },
    { item: "Upskill Courses", quarter: fmtCell(careerSource.upskillCourses?.quarter), ytd: fmtCell(careerSource.upskillCourses?.ytd) },
  ];
  const careerLabels = careerRows.map((r) => r.item);
  const careerQ = careerRows.map((r) => (typeof r.quarter === "number" ? r.quarter : 0));

  const scholarshipRows = [
    { scholarship: "Kinship", applied: fmtCell(scholarshipSource.kinship?.applied), processed: fmtCell(scholarshipSource.kinship?.processed) },
    { scholarship: "Masters / PhD", applied: fmtCell(scholarshipSource.mastersPhd?.applied), processed: fmtCell(scholarshipSource.mastersPhd?.processed) },
  ];
  const scholLabels = scholarshipRows.map((r) => r.scholarship);
  const scholApplied = scholarshipRows.map((r) => (typeof r.applied === "number" ? r.applied : 0));
  const scholProcessed = scholarshipRows.map((r) => (typeof r.processed === "number" ? r.processed : 0));

  return (
    <AnalyticsPanel
      id="section-c"
      title="Development & Employment"
      subtitle="Career services, scholarships, and alumni contributions"
      icon={DashboardIcons.briefcase}
      className="mt-3"
    >
      <AnalyticsGrid>
        <AnalyticsGridItem span={6}>
          <AnalyticsSubheading dotColor="bg-sky-500">Career services</AnalyticsSubheading>
          <ChartInsight>Recruitment, jobs, startups & upskill — QTD metrics</ChartInsight>
          <ChartTableToggle
            widgetId="mgmt-career"
            defaultView="table"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "item", label: "Service" },
                  { key: "quarter", label: periodPrimary, align: "right" },
                  { key: "ytd", label: periodSecondary, align: "right" },
                ]}
                rows={careerRows}
              />
            }
            chart={<BarChartComponent title={`Career metrics (${periodLabel})`} labels={careerLabels} data={careerQ} {...CHART_PROPS} />}
          />
        </AnalyticsGridItem>

        <AnalyticsGridItem span={6}>
          <AnalyticsSubheading dotColor="bg-violet-500">Academic scholarships</AnalyticsSubheading>
          <ChartInsight>Processed: {scholLabels.map((_, i) => `${scholLabels[i]} ${scholProcessed[i]}`).join(" · ")}</ChartInsight>
          <ChartTableToggle
            widgetId="mgmt-scholarships"
            defaultView="table"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "scholarship", label: "Scholarship type" },
                  { key: "applied", label: "Applied", align: "right" },
                  { key: "processed", label: "Processed", align: "right" },
                ]}
                rows={scholarshipRows}
              />
            }
            chart={
              <BarChartComponent
                title="Scholarships: applied"
                subtitle={`Processed — ${scholProcessed.join(", ")}`}
                labels={scholLabels}
                data={scholApplied}
                {...CHART_PROPS}
              />
            }
          />
        </AnalyticsGridItem>

        <AnalyticsGridItem span={12}>
          <AnalyticsSubheading dotColor="bg-rose-500">Alumni give back</AnalyticsSubheading>
          <div className="rounded-lg border border-rose-100 bg-gradient-to-br from-rose-50 to-transparent p-3 dark:border-rose-900/30 dark:from-rose-900/10">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Financial assistance to students</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {typeof giveBack === "number" ? `Rs. ${giveBack.toLocaleString()}` : "—"}
            </p>
            <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">No disbursement total in database yet</p>
          </div>
        </AnalyticsGridItem>
      </AnalyticsGrid>
    </AnalyticsPanel>
  );
}
