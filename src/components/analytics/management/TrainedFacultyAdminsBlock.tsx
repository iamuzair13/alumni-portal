"use client";

import React from "react";
import type { TrainedFacultyAdminsPayload } from "@/lib/analytics/management-dashboard";
import BarChartComponent from "@/components/analytics/BarChartComponent";
import ChartTableToggle from "./ChartTableToggle";
import AnalyticsDataTable from "./AnalyticsDataTable";
import { fmtCell } from "./dashboardFormat";

type Props = {
  data: TrainedFacultyAdminsPayload | undefined;
  isLoading: boolean;
};

export default function TrainedFacultyAdminsBlock({ data, isLoading }: Props) {
  const total = data?.total ?? null;
  const rows = data?.byFaculty ?? [];
  const tableRows = [
    ...rows.map((r) => ({
      faculty: r.faculty,
      facultyId: r.facultyId != null ? String(r.facultyId) : "—",
      count: fmtCell(r.count),
    })),
    {
      faculty: "Total (distinct users)",
      facultyId: "—",
      count: typeof total === "number" ? total : fmtCell(total),
    },
  ];

  const labels = rows.map((r) => (r.faculty.length > 24 ? `${r.faculty.slice(0, 22)}…` : r.faculty));
  const chartData = rows.map((r) => r.count);

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/30 p-2.5 dark:border-violet-900/40 dark:bg-violet-950/20">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">Trained faculty admin users</h3>
      <ChartTableToggle
        widgetId="mgmt-trained-faculty-admins"
        defaultView="table"
        table={
          <AnalyticsDataTable
            isLoading={isLoading}
            columns={[
              { key: "faculty", label: "Faculty" },
              { key: "facultyId", label: "Faculty ID", align: "right" },
              { key: "count", label: "Admins", align: "right" },
            ]}
            rows={tableRows}
          />
        }
        chart={
          rows.length > 0 ? (
            <BarChartComponent
              title="Trained admins by faculty"
              subtitle={typeof total === "number" ? `${total.toLocaleString()} distinct user(s)` : "No data"}
              labels={labels.length > 0 ? labels : ["—"]}
              data={chartData.length > 0 ? chartData : [0]}
              compact
              height={140}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {isLoading ? "Loading…" : "No faculty-scoped admin assignments found."}
            </p>
          )
        }
      />
      {!isLoading && rows.length > 0 && typeof total === "number" && rows.reduce((s, r) => s + (typeof r.count === "number" ? r.count : 0), 0) !== total ? (
        <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
          Row sums may exceed the total when the same user is assigned to multiple faculties.
        </p>
      ) : null}
    </div>
  );
}
