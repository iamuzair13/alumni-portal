"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FacultyRegistrationsBarChart from "@/components/analytics/FacultyRegistrationsBarChart";

type TableColumn = { key: string; label: string; align?: "left" | "right" | "center" };
type TableRow = Record<string, string | number>;

function SectionWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/20">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <span className="text-base" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: TableColumn[]; rows: TableRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="max-h-72 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-gray-50 dark:bg-white/[0.02]"}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 text-gray-700 dark:text-gray-300 ${
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalyticsDashboardClient() {
  const [facultyFilter, setFacultyFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("This Quarter");

  const { data: facultyOptions } = useQuery({
    queryKey: ["organization-faculties", "analytics-filter"],
    queryFn: async () => {
      const res = await fetch("/api/organization/faculties", { headers: { accept: "application/json" } });
      const json = (await res.json()) as {
        success?: boolean;
        faculties?: Array<{ id: number; faculty_name: string }>;
      };
      if (!res.ok || !json.success) {
        throw new Error("Failed to load faculties");
      }
      return json.faculties ?? [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: realtime } = useQuery({
    queryKey: ["analytics-realtime-dashboard", facultyFilter, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("facultyId", facultyFilter);
      params.set("timeRange", timeRange);
      const res = await fetch(`/api/analytics/realtime-dashboard?${params.toString()}`, { headers: { accept: "application/json" } });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error("Failed to load realtime analytics");
      }
      return json;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: alumniCounts } = useQuery({
    queryKey: ["alumni-counts-kpis", facultyFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facultyFilter !== "all") {
        params.append("faculty", facultyFilter);
      }
      const res = await fetch(`/api/alumni/counts${params.toString() ? `?${params.toString()}` : ""}`, {
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as {
        total?: number;
        verified?: number;
        category?: {
          aPlus?: number;
          a?: number;
          b?: number;
          c?: number;
          d?: number;
        };
      };
      if (!res.ok) {
        throw new Error("Failed to load alumni counts");
      }
      return json;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const formatKpiValue = (value: number | null | undefined): string =>
    typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "Under Processing";
  const fmt = (value: number | null | undefined): string | number =>
    typeof value === "number" && Number.isFinite(value) ? value : "Under Processing";

  const cardsStatusData = ((realtime?.sectionB as Record<string, unknown> | undefined)?.cardsStatus ??
    {}) as Record<string, number | null | undefined>;

  const kpis = [
    { title: "Entries", value: formatKpiValue(alumniCounts?.total), subtitle: alumniCounts?.total == null ? "Under Processing" : "Live / Database", icon: "🗂️" },
    { title: "Verified", value: formatKpiValue(alumniCounts?.verified), subtitle: alumniCounts?.verified == null ? "Under Processing" : "Live / Database", icon: "✅" },
    {
      title: "Alumni Honor Cards Issued",
      value: formatKpiValue(cardsStatusData.delivered),
      subtitle: cardsStatusData.delivered == null ? "Under Processing" : "Live / Database",
      icon: "🪪",
    },
    {
      title: "Category A+",
      value: formatKpiValue(alumniCounts?.category?.aPlus),
      subtitle: alumniCounts?.category?.aPlus == null ? "Under Processing" : "Live / Database",
      icon: "⭐",
    },
    {
      title: "Category A",
      value: formatKpiValue(alumniCounts?.category?.a),
      subtitle: alumniCounts?.category?.a == null ? "Under Processing" : "Live / Database",
      icon: "🅰️",
    },
    {
      title: "Category B",
      value: formatKpiValue(alumniCounts?.category?.b),
      subtitle: alumniCounts?.category?.b == null ? "Under Processing" : "Live / Database",
      icon: "🅱️",
    },
    {
      title: "Category C",
      value: formatKpiValue(alumniCounts?.category?.c),
      subtitle: alumniCounts?.category?.c == null ? "Under Processing" : "Live / Database",
      icon: "©️",
    },
    {
      title: "Category D",
      value: formatKpiValue(alumniCounts?.category?.d),
      subtitle: alumniCounts?.category?.d == null ? "Under Processing" : "Live / Database",
      icon: "◼️",
    },
  ];

  const facultySource = ((realtime?.sectionA as Record<string, unknown> | undefined)?.facultyRows ?? []) as Array<{
    faculty: string;
    registrations: number | null;
  }>;
  const facultyTotal = facultySource.reduce((sum, r) => sum + (typeof r.registrations === "number" ? r.registrations : 0), 0);
  const facultyChartData = facultySource
    .filter((r) => typeof r.registrations === "number")
    .map((r) => ({
      faculty: r.faculty || "Under Processing",
      registrations: Number(r.registrations ?? 0),
    }));
  const facultyRows: TableRow[] = facultySource.map((r) => ({
    faculty: r.faculty || "Under Processing",
    registrations: fmt(r.registrations),
    contribution: facultyTotal > 0 && typeof r.registrations === "number" ? `${((r.registrations / facultyTotal) * 100).toFixed(1)}%` : "Under Processing",
  }));

  const activitySource = ((realtime?.sectionB as Record<string, unknown> | undefined)?.activities ??
    {}) as Record<string, { quarter: number | null; ytd: number | null }>;
  const chapterEventsSource = (activitySource as unknown as Record<string, { quarter?: number | null; ytd?: number | null; total?: number | null }>).chapterEvents;
  const engagementActivityRows: TableRow[] = [
    { activity: "Mentorship Sessions", quarter: fmt(activitySource.mentorshipSessions?.quarter), ytd: fmt(activitySource.mentorshipSessions?.ytd) },
    { activity: "Seminars Participation", quarter: fmt(activitySource.seminarsParticipation?.quarter), ytd: fmt(activitySource.seminarsParticipation?.ytd) },
    { activity: "Conferences Participation", quarter: fmt(activitySource.conferencesParticipation?.quarter), ytd: fmt(activitySource.conferencesParticipation?.ytd) },
    { activity: "Alumni Talks", quarter: fmt(activitySource.alumniTalks?.quarter), ytd: fmt(activitySource.alumniTalks?.ytd) },
    { activity: "High Achievers Recognition", quarter: fmt(activitySource.highAchieversRecognition?.quarter), ytd: fmt(activitySource.highAchieversRecognition?.ytd) },
    { activity: "Wellbeing Support", quarter: fmt(activitySource.wellbeingSupport?.quarter), ytd: fmt(activitySource.wellbeingSupport?.ytd) },
  ];

  const careerSource = ((realtime?.sectionC as Record<string, unknown> | undefined)?.career ??
    {}) as Record<string, { quarter: number | null; ytd: number | null }>;
  const careerRows: TableRow[] = [
    { item: "Recruitment Drives", quarter: fmt(careerSource.recruitmentDrives?.quarter), ytd: fmt(careerSource.recruitmentDrives?.ytd) },
    { item: "Jobs Posted (UOL)", quarter: fmt(careerSource.jobsPostedUol?.quarter), ytd: fmt(careerSource.jobsPostedUol?.ytd) },
    { item: "Jobs Posted (Other Employers)", quarter: fmt(careerSource.jobsPostedOtherEmployers?.quarter), ytd: fmt(careerSource.jobsPostedOtherEmployers?.ytd) },
    { item: "Startups Support", quarter: fmt(careerSource.startupsSupport?.quarter), ytd: fmt(careerSource.startupsSupport?.ytd) },
    { item: "Upskill Courses", quarter: fmt(careerSource.upskillCourses?.quarter), ytd: fmt(careerSource.upskillCourses?.ytd) },
  ];

  const scholarshipSource = ((realtime?.sectionC as Record<string, unknown> | undefined)?.scholarships ??
    {}) as Record<string, { applied: number | null; processed: number | null }>;
  const scholarshipRows: TableRow[] = [
    { scholarship: "Kinship", applied: fmt(scholarshipSource.kinship?.applied), processed: fmt(scholarshipSource.kinship?.processed) },
    { scholarship: "Masters / PhD", applied: fmt(scholarshipSource.mastersPhd?.applied), processed: fmt(scholarshipSource.mastersPhd?.processed) },
    { scholarship: "IQ Programs", applied: fmt(scholarshipSource.iqPrograms?.applied), processed: fmt(scholarshipSource.iqPrograms?.processed) },
  ];

  const membershipSource = ((realtime?.sectionD as Record<string, unknown> | undefined)?.memberships ??
    {}) as Record<string, number | null>;
  const perksRows: TableRow[] = [
    { membership: "Gym", active: fmt(membershipSource.gym) },
    { membership: "Swimming Pool", active: fmt(membershipSource.swimmingPool) },
    { membership: "Free Memberships", active: fmt(membershipSource.freeMemberships) },
    { membership: "Healthcare Discounts", active: fmt(membershipSource.healthcareDiscounts) },
    { membership: "Vehicle Stickers", active: fmt(membershipSource.vehicleStickers) },
  ];

  const merchantSource = ((realtime?.sectionD as Record<string, unknown> | undefined)?.merchants ??
    []) as Array<{ merchant: string; discount: string; reference: string }>;
  const merchantRows: TableRow[] =
    merchantSource.length > 0
      ? merchantSource
      : [{ merchant: "Under Processing", discount: "Under Processing", reference: "Under Processing" }];

  const cardsStatus = ((realtime?.sectionB as Record<string, unknown> | undefined)?.cardsStatus ??
    {}) as Record<string, number | null>;
  const honorStatuses = [
    { label: "Applied", value: fmt(cardsStatus.applied) },
    { label: "Review", value: fmt(cardsStatus.review) },
    { label: "On-hold", value: fmt(cardsStatus.onHold) },
    { label: "Under Printing", value: fmt(cardsStatus.underPrinting) },
    { label: "Ready for Delivery", value: fmt(cardsStatus.readyForDelivery) },
    { label: "Delivered", value: fmt(cardsStatus.delivered) },
  ];
  const chapterStats = ((realtime?.sectionB as Record<string, unknown> | undefined)?.chaptersAssociations ??
    {}) as Record<string, number | null>;
  const discountCategories = ((realtime?.sectionD as Record<string, unknown> | undefined)?.discountCategories ??
    {}) as Record<string, number | null>;
  const giveBackFinancialAssistance = ((realtime?.sectionC as Record<string, unknown> | undefined)
    ?.giveBackFinancialAssistance ?? null) as number | null;

  return (
    <div className="space-y-6 bg-gray-100/80 p-4 dark:bg-gray-950 md:p-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Alumni Management Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Overview of system-wide analytics</p>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={facultyFilter}
                onChange={(e) => setFacultyFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200"
              >
                <option value="all">All Faculties</option>
                {(facultyOptions ?? []).map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.faculty_name}
                  </option>
                ))}
              </select>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200"
              >
                <option>This Quarter</option>
                <option>YTD</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="col-span-12 sm:col-span-6 xl:col-span-3">
            <DashboardCard title={kpi.title} value={kpi.value} subtitle={kpi.subtitle} icon={kpi.icon} />
          </div>
        ))}
      </section>

      <SectionWrapper title="Alumni Database" subtitle="Registration & Key Information">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-6">
            <FacultyRegistrationsBarChart
              data={facultyChartData}
              subtitle={timeRange === "YTD" ? "YTD live registrations by faculty" : "This Quarter live registrations by faculty"}
            />
          </div>
          <div className="col-span-12 xl:col-span-6">
            <DataTable
              columns={[
                { key: "faculty", label: "Faculty" },
                { key: "registrations", label: "Registrations", align: "right" },
                { key: "contribution", label: "% Contribution", align: "right" },
              ]}
              rows={[...facultyRows, { faculty: "Total", registrations: facultyTotal || "Under Processing", contribution: facultyTotal > 0 ? "100%" : "Under Processing" }]}
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper title="Engagement & Networking">
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Chapters & Associations</h3>
            <div className="mb-4 grid grid-cols-12 gap-3">
              <div className="col-span-6 md:col-span-4 xl:col-span-2"><StatCard label="National Chapters" value={fmt(chapterStats.nationalChapters)} /></div>
              <div className="col-span-6 md:col-span-4 xl:col-span-2"><StatCard label="International Chapters" value={fmt(chapterStats.internationalChapters)} /></div>
              <div className="col-span-6 md:col-span-4 xl:col-span-2"><StatCard label="Associations" value={fmt(chapterStats.associations)} /></div>
              <div className="col-span-6 md:col-span-4 xl:col-span-2"><StatCard label="Members" value={fmt(chapterStats.members)} /></div>
              <div className="col-span-6 md:col-span-4 xl:col-span-2"><StatCard label="Leaders Appointed" value={fmt(chapterStats.leadersAppointed)} /></div>
              <div className="col-span-6 md:col-span-4 xl:col-span-2"><StatCard label="Meetups" value={fmt(chapterStats.meetupsTotal)} hint={`Q: ${fmt(chapterStats.meetupsQuarter)} | YTD: ${fmt(chapterStats.meetupsYtd)} | Total: ${fmt(chapterStats.meetupsTotal)}`} /></div>
            </div>
            <DataTable
              columns={[
                { key: "metric", label: "Metric" },
                { key: "quarter", label: "This Quarter", align: "right" },
                { key: "ytd", label: "YTD", align: "right" },
                { key: "total", label: "Total", align: "right" },
              ]}
              rows={[
                { metric: "Meetups", quarter: fmt(chapterStats.meetupsQuarter), ytd: fmt(chapterStats.meetupsYtd), total: fmt(chapterStats.meetupsTotal) },
                { metric: "Chapter Events", quarter: fmt(chapterEventsSource?.quarter), ytd: fmt(chapterEventsSource?.ytd), total: fmt(chapterEventsSource?.total) },
              ]}
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Alumni Honor Cards Status</h3>
            <div className="grid grid-cols-12 gap-3">
              {honorStatuses.map((s) => (
                <div key={s.label} className="col-span-6 md:col-span-4 xl:col-span-2">
                  <StatCard label={s.label} value={s.value} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Engagement Activities</h3>
            <DataTable
              columns={[
                { key: "activity", label: "Activity" },
                { key: "quarter", label: "This Quarter", align: "right" },
                { key: "ytd", label: "YTD", align: "right" },
              ]}
              rows={engagementActivityRows}
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper title="Development & Support">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Career</h3>
            <DataTable
              columns={[
                { key: "item", label: "Item" },
                { key: "quarter", label: "This Quarter", align: "right" },
                { key: "ytd", label: "YTD", align: "right" },
              ]}
              rows={careerRows}
            />
          </div>
          <div className="col-span-12 xl:col-span-6 space-y-4">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Academic (Scholarships)</h3>
              <DataTable
                columns={[
                  { key: "scholarship", label: "Scholarship Type" },
                  { key: "applied", label: "Applied", align: "right" },
                  { key: "processed", label: "Processed", align: "right" },
                ]}
                rows={scholarshipRows}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Alumni Give Back</h3>
              <StatCard label="Financial Assistance to Students" value={fmt(giveBackFinancialAssistance)} hint="YTD disbursement" />
            </div>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper title="Perks & Benefits">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Memberships</h3>
            <DataTable
              columns={[
                { key: "membership", label: "Type" },
                { key: "active", label: "Active", align: "right" },
              ]}
              rows={perksRows}
            />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Merchant Discounts Categories</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Dining & Cafes" value={fmt(discountCategories.diningAndCafes)} />
              <StatCard label="Retail & Shopping" value={fmt(discountCategories.retailAndShopping)} />
              <StatCard label="Travel & Leisure" value={fmt(discountCategories.travelAndLeisure)} />
              <StatCard label="Health & Wellness" value={fmt(discountCategories.healthAndWellness)} />
              <StatCard label="Professional Services" value={fmt(discountCategories.professionalServices)} />
              <StatCard label="Financial Services" value={fmt(discountCategories.financialServices)} />
            </div>
          </div>
          <div className="col-span-12 xl:col-span-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Merchant Details</h3>
            <DataTable
              columns={[
                { key: "merchant", label: "Merchant Name" },
                { key: "discount", label: "Discount" },
                { key: "reference", label: "Reference" },
              ]}
              rows={merchantRows}
            />
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}

