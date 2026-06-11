"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { Bar as BarMini } from "../charts/Bar";
import { Donut } from "../charts/Donut";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { mapCareerBenefits } from "../data/mapPayloadToCards";
import { getPeriodColumnLabels } from "@/components/analytics/v2/utils/periodColumnLabels";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";

function truncateLabel(name: string, max = 16): string {
  const t = name.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function CareerExpandPanel({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const career = mapCareerBenefits(data);
  const { primary: periodPrimary, secondary: periodSecondary } = getPeriodColumnLabels(data);
  const quarterCol = `This Q · ${career.quarterLabel}`;

  const jobCategoryRows = useMemo(() => {
    const body = career.jobs.categoryRows.map((row) => ({
      category: row.category,
      total: row.total.toLocaleString(),
      uol: row.uol.toLocaleString(),
      other: row.other.toLocaleString(),
      quarter: row.quarter.toLocaleString(),
      ytd: row.ytd.toLocaleString(),
      share: pct(row.total, career.jobs.total),
    }));
    if (!body.length) return body;
    const sum = career.jobs.categoryRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        uol: acc.uol + row.uol,
        other: acc.other + row.other,
        quarter: acc.quarter + row.quarter,
        ytd: acc.ytd + row.ytd,
      }),
      { total: 0, uol: 0, other: 0, quarter: 0, ytd: 0 }
    );
    return [
      ...body,
      {
        category: "Total",
        total: sum.total.toLocaleString(),
        uol: sum.uol.toLocaleString(),
        other: sum.other.toLocaleString(),
        quarter: sum.quarter.toLocaleString(),
        ytd: sum.ytd.toLocaleString(),
        share: career.jobs.total > 0 ? "100%" : "—",
      },
    ];
  }, [career.jobs]);

  const employerMix = useMemo(
    () =>
      [
        { label: "UOL", value: career.jobs.uol, color: KPI_COLOR_HEX.indigo },
        { label: "Other", value: career.jobs.other, color: KPI_COLOR_HEX.sky },
      ].filter((p) => p.value > 0),
    [career.jobs.uol, career.jobs.other]
  );

  const categoryChart = useMemo(
    () =>
      [...career.jobs.categoryRows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((row) => ({
          label: truncateLabel(row.category),
          value: row.total,
        })),
    [career.jobs.categoryRows]
  );

  const careerServiceRows = useMemo(() => {
    const c = career.careerServices;
    if (!c) return [];
    return [
      {
        service: "Recruitment drives",
        quarter: num(c.recruitmentDrives?.quarter),
        ytd: num(c.recruitmentDrives?.ytd),
      },
      {
        service: "Jobs posted (UOL)",
        quarter: num(c.jobsPostedUol?.quarter),
        ytd: num(c.jobsPostedUol?.ytd),
      },
      {
        service: "Jobs posted (other)",
        quarter: num(c.jobsPostedOtherEmployers?.quarter),
        ytd: num(c.jobsPostedOtherEmployers?.ytd),
      },
      {
        service: "Startups support",
        quarter: num(c.startupsSupport?.quarter),
        ytd: num(c.startupsSupport?.ytd),
      },
      {
        service: "Upskill courses",
        quarter: num(c.upskillCourses?.quarter),
        ytd: num(c.upskillCourses?.ytd),
      },
    ].map((row) => ({
      service: row.service,
      quarter: row.quarter.toLocaleString(),
      ytd: row.ytd.toLocaleString(),
    }));
  }, [career.careerServices]);

  const facultyScholarshipTable = useMemo(() => {
    const body = career.facultyScholarshipRows.map((row) => ({
      faculty: row.faculty,
      applied: row.applied.toLocaleString(),
      processed: row.processed.toLocaleString(),
      kinship: row.kinshipApplied.toLocaleString(),
      masters: row.mastersApplied.toLocaleString(),
      iq: row.iqApplied.toLocaleString(),
      share: pct(row.applied, career.scholarshipsApplied),
    }));
    if (!body.length) return body;
    const sum = career.facultyScholarshipRows.reduce(
      (acc, row) => ({
        applied: acc.applied + row.applied,
        processed: acc.processed + row.processed,
        kinship: acc.kinship + row.kinshipApplied,
        masters: acc.masters + row.mastersApplied,
        iq: acc.iq + row.iqApplied,
      }),
      { applied: 0, processed: 0, kinship: 0, masters: 0, iq: 0 }
    );
    return [
      ...body,
      {
        faculty: "Total",
        applied: sum.applied.toLocaleString(),
        processed: sum.processed.toLocaleString(),
        kinship: sum.kinship.toLocaleString(),
        masters: sum.masters.toLocaleString(),
        iq: sum.iq.toLocaleString(),
        share: career.scholarshipsApplied > 0 ? "100%" : "—",
      },
    ];
  }, [career.facultyScholarshipRows, career.scholarshipsApplied]);

  const facultyScholarshipChart = useMemo(
    () =>
      [...career.facultyScholarshipRows]
        .filter((row) => row.applied > 0)
        .sort((a, b) => b.applied - a.applied)
        .slice(0, 8)
        .map((row) => ({
          faculty: truncateLabel(row.faculty),
          fullName: row.faculty,
          kinship: row.kinshipApplied,
          masters: row.mastersApplied,
          iq: row.iqApplied,
        })),
    [career.facultyScholarshipRows]
  );

  const jobKpis = [
    { label: "Total jobs", value: career.jobs.total, sub: "All postings", color: KPI_COLOR_HEX.violet },
    { label: "UOL", value: career.jobs.uol, sub: pct(career.jobs.uol, career.jobs.total), color: KPI_COLOR_HEX.indigo },
    { label: "Other employers", value: career.jobs.other, sub: pct(career.jobs.other, career.jobs.total), color: KPI_COLOR_HEX.sky },
    { label: "This quarter", value: career.jobs.quarter, sub: career.quarterLabel, color: KPI_COLOR_HEX.amber },
  ];

  const scholarshipKpis = [
    {
      label: "Scholarships applied",
      value: career.scholarshipsApplied,
      sub: `${career.scholarshipsProcessed} processed`,
      color: KPI_COLOR_HEX.rose,
    },
    {
      label: "Kinship",
      value: career.scholarshipTotals.kinshipApplied,
      sub: `${career.scholarshipTotals.kinshipProcessed} processed`,
      color: KPI_COLOR_HEX.violet,
    },
    {
      label: "Masters / PhD",
      value: career.scholarshipTotals.mastersApplied,
      sub: `${career.scholarshipTotals.mastersProcessed} processed`,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      label: "IQ programs",
      value: career.scholarshipTotals.iqApplied,
      sub: `${career.scholarshipTotals.iqProcessed} processed`,
      color: KPI_COLOR_HEX.sky,
    },
  ];

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Job board
        </h3>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {jobKpis.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {k.label}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: k.color }}>
                {k.value.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
            </div>
          ))}
        </div>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "category", label: "Category" },
            { key: "total", label: "Total", align: "right" },
            { key: "uol", label: "UOL", align: "right" },
            { key: "other", label: "Other", align: "right" },
            { key: "quarter", label: quarterCol, align: "right" },
            { key: "ytd", label: "YTD", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={jobCategoryRows}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-1">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Employer mix
          </h3>
          <div className="h-[180px]">
            {employerMix.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No job data</p>
            ) : (
              <Donut data={employerMix} showLegend minSlicePercent={0.04} />
            )}
          </div>
        </section>
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40 lg:col-span-2">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Top job categories
          </h3>
          {categoryChart.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No categories recorded</p>
          ) : (
            <BarMini
              data={categoryChart}
              height={Math.max(140, categoryChart.length * 24)}
              horizontal
              showLabels
            />
          )}
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Career services
        </h3>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "service", label: "Service" },
            { key: "quarter", label: periodPrimary, align: "right" },
            { key: "ytd", label: periodSecondary, align: "right" },
          ]}
          rows={careerServiceRows}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          Scholarships by faculty
        </h3>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {scholarshipKpis.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:from-gray-900/80 dark:to-gray-900/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {k.label}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: k.color }}>
                {k.value.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{k.sub}</p>
            </div>
          ))}
        </div>
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "applied", label: "Applied", align: "right" },
            { key: "processed", label: "Processed", align: "right" },
            { key: "kinship", label: "Kinship", align: "right" },
            { key: "masters", label: "Masters/PhD", align: "right" },
            { key: "iq", label: "IQ", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ]}
          rows={facultyScholarshipTable}
        />
      </section>

      {facultyScholarshipChart.length > 0 ? (
        <section className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Top faculties · scholarship applications
          </h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyScholarshipChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
                <XAxis dataKey="faculty" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10 }}
                  labelFormatter={(_label, payload) =>
                    (payload?.[0]?.payload as { fullName?: string })?.fullName ?? _label
                  }
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconType="circle" iconSize={8} />
                <Bar dataKey="kinship" name="Kinship" fill={KPI_COLOR_HEX.violet} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
                <Bar dataKey="masters" name="Masters/PhD" fill={KPI_COLOR_HEX.indigo} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
                <Bar dataKey="iq" name="IQ" fill={KPI_COLOR_HEX.sky} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Jobs from{" "}
        <a href="/dashboard?tab=jobs" className="text-violet-600 underline dark:text-violet-400">
          Job board
        </a>
        . Scholarships respect faculty filters; jobs are organization-wide.
      </p>
    </div>
  );
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
