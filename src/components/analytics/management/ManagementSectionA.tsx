"use client";

import React from "react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import FacultyRegistrationsBarChart from "@/components/analytics/FacultyRegistrationsBarChart";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import PieChartComponent from "@/components/analytics/PieChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { DashboardIcons } from "./DashboardPrimitives";
import { fmtCell } from "./dashboardFormat";
import { AnalyticsPanel } from "@/components/analytics/v2/layout/AnalyticsPanel";
import { AnalyticsGrid, AnalyticsGridItem } from "@/components/analytics/v2/layout/AnalyticsGrid";

type Props = {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
  periodLabel: string;
};

const CHART_PROPS = { compact: true, height: 150 } as const;

/* ─── primitives ─── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-shadow hover:shadow-md dark:bg-gray-900 dark:ring-white/10 ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  dotColor,
  insight,
  badge,
}: {
  title: string;
  dotColor: string;
  insight?: string;
  badge?: string;
}) {
  return (
    <div className="mb-4 shrink-0">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        {badge ? (
          <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {badge}
          </span>
        ) : null}
      </div>
      {insight ? (
        <p className="mt-1.5 text-sm font-medium leading-tight text-gray-900 dark:text-gray-100">{insight}</p>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="ml-auto h-5 w-14 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mt-auto h-[150px] animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    </Card>
  );
}

/* ─── section ─── */

export default function ManagementSectionA({ data, isLoading, periodLabel }: Props) {
  const a = data?.sectionA;

  /* faculty */
  const facultySource = a?.facultyRows ?? [];
  const facultyTotal = facultySource.reduce(
    (sum, r) => sum + (typeof r.registrations === "number" ? r.registrations : 0),
    0
  );
  const facultyChartData = facultySource
    .filter((r) => typeof r.registrations === "number")
    .map((r) => ({ faculty: r.faculty || "Unknown", registrations: Number(r.registrations ?? 0) }));
  const facultyRows = facultySource.map((r) => ({
    faculty: r.faculty || "Unknown",
    registrations: fmtCell(r.registrations),
    contribution:
      facultyTotal > 0 && typeof r.registrations === "number"
        ? `${((r.registrations / facultyTotal) * 100).toFixed(1)}%`
        : "—",
  }));
  const topFaculty = [...facultyChartData].sort((x, y) => y.registrations - x.registrations)[0];
  const topShare =
    facultyTotal > 0 && topFaculty ? ((topFaculty.registrations / facultyTotal) * 100).toFixed(1) : "0";

  /* transition */
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
  const topTransition = [...transitionRows].sort((x, y) => (Number(y.count) || 0) - (Number(x.count) || 0))[0];

  /* occupation */
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

  /* province */
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
  const topRegion = [...provRows].sort((x, y) => (Number(y.count) || 0) - (Number(x.count) || 0))[0];

  /* ── loading skeleton ── */
  if (isLoading) {
    return (
      <AnalyticsPanel
        id="section-a"
        title="Growth & Alumni Database"
        subtitle="Registration distribution, transition, occupation, and location"
        icon={DashboardIcons.users}
        className="mt-3"
      >
        <AnalyticsGrid className="gap-4">
          <AnalyticsGridItem span={8}>
            <SkeletonCard />
          </AnalyticsGridItem>
          <AnalyticsGridItem span={4}>
            <SkeletonCard />
          </AnalyticsGridItem>
          <AnalyticsGridItem span={4}>
            <SkeletonCard />
          </AnalyticsGridItem>
          <AnalyticsGridItem span={8}>
            <SkeletonCard />
          </AnalyticsGridItem>
        </AnalyticsGrid>
      </AnalyticsPanel>
    );
  }

  return (
    <AnalyticsPanel
      id="section-a"
      title="Growth & Alumni Database"
      subtitle="Registration distribution, transition, occupation, and location"
      icon={DashboardIcons.users}
      className="mt-3"
    >
      <AnalyticsGrid className="gap-4">
        {/* row 1 – faculty (primary) + transition */}
        <AnalyticsGridItem span={8}>
          <Card>
            <CardHeader
              title="Faculty registrations"
              dotColor="bg-indigo-500"
              insight={
                topFaculty
                  ? `Top: ${topFaculty.faculty} — ${topShare}% of ${facultyTotal.toLocaleString()} total`
                  : "No faculty data"
              }
              badge={periodLabel}
            />
            <div className="min-w-0 flex-1">
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
                  <FacultyRegistrationsBarChart
                    data={facultyChartData}
                    subtitle={`Registrations by faculty (${periodLabel})`}
                    compact
                  />
                }
              />
            </div>
          </Card>
        </AnalyticsGridItem>


        {/* row 2 – occupation + province (data-heavy, gets more width) */}
        <AnalyticsGridItem span={4}>
          <Card>
            <CardHeader
              title="Current occupation"
              dotColor="bg-emerald-500"
              insight={
                typeof oc?.employed === "number"
                  ? `${oc.employed.toLocaleString()} employed alumni`
                  : "—"
              }
            />
            <div className="min-w-0 flex-1">
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
                chart={
                  <PieChartComponent
                    title="Occupation mix"
                    labels={occLabels}
                    data={occData}
                    {...CHART_PROPS}
                  />
                }
              />
            </div>
          </Card>
        </AnalyticsGridItem>

        <AnalyticsGridItem span={8}>
          <Card>
            <CardHeader
              title="Province / location"
              dotColor="bg-violet-500"
              insight={topRegion ? `Largest: ${topRegion.region} (${topRegion.count})` : "—"}
            />
            <div className="min-w-0 flex-1">
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
                chart={
                  <BarChartComponent
                    title="Location distribution"
                    subtitle="Province & overseas"
                    labels={provLabels}
                    data={provData}
                    {...CHART_PROPS}
                  />
                }
              />
            </div>
          </Card>
        </AnalyticsGridItem>
      </AnalyticsGrid>
    </AnalyticsPanel>
  );
}