"use client";

import React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionC } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { SectionWrapper, DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
};

export default function ManagementSectionC({ data, isLoading }: Props) {
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
    { scholarship: "IQ Programs", applied: fmtCell(scholarshipSource.iqPrograms?.applied), processed: fmtCell(scholarshipSource.iqPrograms?.processed) },
  ];
  const scholLabels = scholarshipRows.map((r) => r.scholarship);
  const scholApplied = scholarshipRows.map((r) => (typeof r.applied === "number" ? r.applied : 0));
  const scholProcessed = scholarshipRows.map((r) => (typeof r.processed === "number" ? r.processed : 0));

  return (
    <div className="mt-6">
      <SectionWrapper
        id="section-c"
        title="Development & Support"
        subtitle="Career services, scholarships, and alumni contributions"
        icon={DashboardIcons.briefcase}
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Career services
              </h3>
              <ChartTableToggle
                widgetId="mgmt-career"
                defaultView="table"
                table={
                  <AnalyticsDataTable
                    isLoading={isLoading}
                    columns={[
                      { key: "item", label: "Service" },
                      { key: "quarter", label: "This Quarter", align: "right" },
                      { key: "ytd", label: "YTD", align: "right" },
                    ]}
                    rows={careerRows}
                  />
                }
                chart={<BarChartComponent title="Career metrics (this quarter)" labels={careerLabels} data={careerQ} />}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                Academic scholarships
              </h3>
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
                    title="Scholarships: applied vs processed"
                    subtitle="Stacked comparison shown as two series would require chart upgrade — applied counts"
                    labels={scholLabels}
                    data={scholApplied}
                  />
                }
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Processed counts: {scholLabels.map((_, i) => `${scholLabels[i]} ${scholProcessed[i]}`).join(" · ")}</p>
            </div>

            <div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Alumni give back
              </h3>
              <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-transparent p-6 dark:border-rose-900/30 dark:from-rose-900/10">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Financial assistance to students</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {typeof giveBack === "number" ? `Rs. ${giveBack.toLocaleString()}` : "—"}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">No disbursement total in database yet</p>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
