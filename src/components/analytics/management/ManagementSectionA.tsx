"use client";

import React from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import FacultyRegistrationsBarChart from "@/components/analytics/FacultyRegistrationsBarChart";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import PieChartComponent from "@/components/analytics/PieChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import TrainedFacultyAdminsBlock from "./TrainedFacultyAdminsBlock";
import { SectionWrapper, ProgressBar, DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
  timeRange: string;
};

export default function ManagementSectionA({ data, isLoading, timeRange }: Props) {
  const a = data?.sectionA;
  const facultySource = a?.facultyRows ?? [];
  const facultyTotal = facultySource.reduce((sum, r) => sum + (typeof r.registrations === "number" ? r.registrations : 0), 0);
  const maxRegistrations = Math.max(...facultySource.map((r) => (typeof r.registrations === "number" ? r.registrations : 0)), 1);

  const facultyChartData = facultySource
    .filter((r) => typeof r.registrations === "number")
    .map((r) => ({ faculty: r.faculty || "Unknown", registrations: Number(r.registrations ?? 0) }));

  const facultyRows = facultySource.map((r) => ({
    faculty: r.faculty || "Unknown",
    registrations: fmtCell(r.registrations),
    contribution: facultyTotal > 0 && typeof r.registrations === "number" ? `${((r.registrations / facultyTotal) * 100).toFixed(1)}%` : "—",
  }));

  const tv = a?.transitionVelocity;
  const transitionRows = [
    { bucket: "Before graduation", count: fmtCell(tv?.beforeGraduation) },
    { bucket: "Immediately after graduation", count: fmtCell(tv?.immediateAfterGraduation) },
    { bucket: "Within 3 months", count: fmtCell(tv?.within3Months) },
    { bucket: "Within 6 months", count: fmtCell(tv?.within6Months) },
    { bucket: "After 6 months", count: fmtCell(tv?.after6Months) },
    { bucket: "Other / unknown", count: fmtCell(tv?.unknown) },
  ];
  const transitionLabels = transitionRows.map((r) => r.bucket);
  const transitionData = transitionRows.map((r) => (typeof r.count === "number" ? r.count : 0));

  const oc = a?.currentOccupation;
  const occRows = [
    { bucket: "Employed", count: fmtCell(oc?.employed) },
    { bucket: "Self-employed", count: fmtCell(oc?.selfEmployed) },
    { bucket: "Unemployed (searching)", count: fmtCell(oc?.unemployedSearching) },
    { bucket: "Unemployed (by choice)", count: fmtCell(oc?.unemployedByChoice) },
    { bucket: "Other", count: fmtCell(oc?.other) },
  ];
  const occLabels = occRows.map((r) => r.bucket);
  const occData = occRows.map((r) => (typeof r.count === "number" ? r.count : 0));

  const pl = a?.provinceLocation;
  const provRows = [
    { region: "Punjab", count: fmtCell(pl?.punjab) },
    { region: "Islamabad", count: fmtCell(pl?.islamabad) },
    { region: "KPK", count: fmtCell(pl?.kpk) },
    { region: "Sindh", count: fmtCell(pl?.sindh) },
    { region: "AJK", count: fmtCell(pl?.ajk) },
    { region: "GB", count: fmtCell(pl?.gb) },
    { region: "Balochistan", count: fmtCell(pl?.balochistan) },
    { region: "Overseas", count: fmtCell(pl?.overseas) },
    { region: "Other", count: fmtCell(pl?.other) },
  ];
  const provLabels = provRows.map((r) => r.region);
  const provData = provRows.map((r) => (typeof r.count === "number" ? r.count : 0));

  return (
    <SectionWrapper
      id="section-a"
      title="Alumni Database"
      subtitle="Registration distribution, transition, occupation, and location"
      icon={DashboardIcons.users}
    >
      <div className="mb-8">
        <TrainedFacultyAdminsBlock data={a?.trainedFacultyAdmins} isLoading={isLoading} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Faculty registrations</h3>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
            {timeRange}
          </span>
        </div>
        <ChartTableToggle
          widgetId="mgmt-faculty-reg"
          defaultView="chart"
          table={
            <AnalyticsDataTable
              isLoading={isLoading}
              columns={[
                { key: "faculty", label: "Faculty" },
                { key: "registrations", label: "Registrations", align: "right" },
                { key: "contribution", label: "Share", align: "right" },
              ]}
              rows={[
                ...facultyRows,
                {
                  faculty: "Total",
                  registrations: facultyTotal || "—",
                  contribution: facultyTotal > 0 ? "100%" : "—",
                },
              ]}
            />
          }
          chart={
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/30">
              <FacultyRegistrationsBarChart
                data={facultyChartData}
                subtitle={timeRange === "YTD" ? "Year-to-date registrations by faculty" : "Registrations by faculty (filtered)"}
              />
            </div>
          }
        />
        
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Transition velocity</h3>
          <ChartTableToggle
            widgetId="mgmt-transition"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "bucket", label: "Timing" },
                  { key: "count", label: "Alumni", align: "right" },
                ]}
                rows={transitionRows}
              />
            }
            chart={<BarChartComponent title="Transition after graduation" subtitle="Alumni count by timing" labels={transitionLabels} data={transitionData} />}
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Current occupation</h3>
          <ChartTableToggle
            widgetId="mgmt-occupation"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "bucket", label: "Status" },
                  { key: "count", label: "Alumni", align: "right" },
                ]}
                rows={occRows}
              />
            }
            chart={<PieChartComponent title="Occupation mix" labels={occLabels} data={occData} />}
          />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Province / location</h3>
          <ChartTableToggle
            widgetId="mgmt-province"
            table={
              <AnalyticsDataTable
                isLoading={isLoading}
                columns={[
                  { key: "region", label: "Region" },
                  { key: "count", label: "Alumni", align: "right" },
                ]}
                rows={provRows}
              />
            }
            chart={<BarChartComponent title="Location distribution" subtitle="Based on province & overseas detection" labels={provLabels} data={provData} />}
          />
        </div>
      </div>
    </SectionWrapper>
  );
}
