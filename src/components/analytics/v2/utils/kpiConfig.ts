import type React from "react";
import type { ManagementDashboardPayload, ManagementDashboardSectionA, TrainedFacultyAdminsPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import { buildSparklineSeries, computeTrendDelta } from "@/components/dashboard/dashboard-stats-config";
import { formatKpiValue } from "@/components/analytics/management/dashboardFormat";
import { DashboardIcons } from "@/components/analytics/management/DashboardPrimitives";

export type KpiFacultyExpandRow = {
  faculty: string;
  facultyId: number | null;
  count: number;
};

export type KpiConfigItem = {
  title: string;
  value: string;
  /** Paired rate or ratio shown beside the primary value (e.g. verification %). */
  secondaryValue?: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "orange" | "slate" | "blue";
  trend?: { value: string; positive: boolean };
  sparkline?: number[];
  expandable?: boolean;
  expandFaculties?: KpiFacultyExpandRow[];
};

export type KpiGroupLayout = "table" | "columns";

export type AnalyticsChartType =
  | "donut"
  | "bar"
  | "funnel"
  | "treemap"
  | "geo"
  | "heatmap"
  | "grouped-bar"
  | "stacked-bar"
  | "radar";

export type ChartSeriesPoint = {
  label: string;
  value: number;
  color?: string;
  meta?: Record<string, unknown>;
};

export type KpiConfigGroup = {
  id: string;
  label: string;
  description?: string;
  /** `columns` renders items as side-by-side tier cards (e.g. A+–D). */
  layout?: KpiGroupLayout;
  items: KpiConfigItem[];
  chartType?: AnalyticsChartType;
  chartSeries?: ChartSeriesPoint[];
  chartSeriesSecondary?: ChartSeriesPoint[];
  chartMeta?: { primaryLabel?: string; secondaryLabel?: string };
  insight?: string;
  collapsible?: boolean;
};

function pct(numerator: number | null | undefined, denominator: number | null | undefined): string {
  if (!denominator || denominator <= 0 || numerator == null) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function truncateLabel(label: string, max = 26): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** KPI rows from `user_access_assignments` / `user_resource_access` trained admin payload (section A). */
function buildTrainedAdminGroup(trained: TrainedFacultyAdminsPayload | undefined): KpiConfigGroup {
  const byFaculty = [...(trained?.byFaculty ?? [])].sort((a, b) => b.count - a.count);
  const assignmentRows = byFaculty.reduce((sum, row) => sum + row.count, 0);

  const items: KpiConfigItem[] = [
    {
      title: "Trained Admins",
      value: formatKpiValue(trained?.total),
      subtitle: "Distinct portal users",
      icon: DashboardIcons.users,
      color: "violet",
    },
    {
      title: "Faculties Covered",
      value: formatKpiValue(byFaculty.length),
      subtitle: "With scoped assignments",
      icon: DashboardIcons.users,
      color: "indigo",
    },
  ];

  for (const row of byFaculty.slice(0, 3)) {
    items.push({
      title: truncateLabel(row.faculty),
      value: formatKpiValue(row.count),
      subtitle: row.facultyId != null ? `Faculty ID ${row.facultyId}` : "Admins assigned",
      icon: DashboardIcons.verified,
      color: "violet",
    });
  }

  if (byFaculty.length > 3) {
    const rest = byFaculty.slice(3);
    const restCount = rest.reduce((sum, row) => sum + row.count, 0);
    items.push({
      title: "Other Faculties",
      value: formatKpiValue(restCount),
      subtitle: `${rest.length} more · tap to expand`,
      icon: DashboardIcons.users,
      color: "slate",
      expandable: true,
      expandFaculties: rest.map((row) => ({
        faculty: row.faculty,
        facultyId: row.facultyId,
        count: row.count,
      })),
    });
  }

  return {
    id: "admin-trained",
    label: "Trained Faculty Admins",
    description: "Admin/viewer users with faculty scope (user_access_assignments × users)",
    items,
  };
}

/** Occupation transition timing buckets from section A (`occupation_transition_timing`). */
function buildTransitionVelocityGroup(tv: ManagementDashboardSectionA["transitionVelocity"] | undefined): KpiConfigGroup {
  const buckets: Array<{ title: string; value: number | null | undefined; subtitle: string; color: KpiConfigItem["color"] }> = [
    { title: "Before graduation", value: tv?.beforeGraduation, subtitle: "Pre-graduation transition", color: "sky" },
    { title: "Immediate after grad", value: tv?.immediateAfterGraduation, subtitle: "Right after graduation", color: "indigo" },
    { title: "Within 3 months", value: tv?.within3Months, subtitle: "First quarter post-grad", color: "violet" },
    { title: "Within 6 months", value: tv?.within6Months, subtitle: "Half-year window", color: "amber" },
    { title: "After 6 months", value: tv?.after6Months, subtitle: "Delayed transition", color: "orange" },
    { title: "Other / unknown", value: tv?.unknown, subtitle: "Unclassified timing", color: "slate" },
  ];

  const total = buckets.reduce((sum, b) => sum + (typeof b.value === "number" ? b.value : 0), 0);
  const earlyTransition =
    (tv?.beforeGraduation ?? 0) + (tv?.immediateAfterGraduation ?? 0) + (tv?.within3Months ?? 0);

  const items: KpiConfigItem[] = [
    {
      title: "Tracked transitions",
      value: formatKpiValue(total > 0 ? total : null),
      subtitle: "Alumni with timing recorded",
      icon: DashboardIcons.chart,
      color: "blue",
    },
    {
      title: "Early transition rate",
      value: pct(earlyTransition, total),
      subtitle: "Before grad · immediate · ≤3 mo",
      icon: DashboardIcons.chart,
      color: "emerald",
    },
    ...buckets.map((b) => ({
      title: b.title,
      value: formatKpiValue(b.value),
      subtitle: total > 0 && typeof b.value === "number" ? `${pct(b.value, total)} of tracked` : b.subtitle,
      icon: DashboardIcons.briefcase,
      color: b.color,
    })),
  ];

  return {
    id: "transition-velocity",
    label: "Transition Velocity",
    description: "How quickly alumni move into occupation after graduation",
    items,
  };
}

export function buildAllKpiGroups(
  data: ManagementDashboardPayload | undefined,
  trends: AlumniTrendPoint[] | undefined
): KpiConfigGroup[] {
  const ah = data?.alumniHeadline;
  const kpis = data?.kpis;
  const cards = data?.sectionB?.cardsStatus;
  const chapters = data?.sectionB?.chaptersAssociations;
  const oc = data?.sectionA?.currentOccupation;
  const trainedAdmins = data?.sectionA?.trainedFacultyAdmins;
  const transitionVelocity = data?.sectionA?.transitionVelocity;
  const timeRange = data?.meta?.timeRange ?? "This Quarter";

  const employed = oc?.employed ?? 0;
  const jobSeekers = (oc?.unemployedSearching ?? 0) + (oc?.unemployedByChoice ?? 0);
  const placementDenom = employed + jobSeekers + (oc?.selfEmployed ?? 0);

  const totalSpark = trends ? buildSparklineSeries(trends, "total") : undefined;
  const verifiedSpark = trends ? buildSparklineSeries(trends, "verified") : undefined;
  const activeSpark = trends ? buildSparklineSeries(trends, "active") : undefined;

  return [
    {
      id: "alumni-overview",
      label: "Alumni Overview",
      description: "Database health, verification & activity",
      items: [
        { title: "Total Alumni", value: formatKpiValue(kpis?.totalAlumni), subtitle: "API aggregate", icon: DashboardIcons.entries, color: "blue", sparkline: totalSpark },
        { title: "Verified Alumni", value: formatKpiValue(ah?.verified), secondaryValue: pct(ah?.verified, ah?.total), subtitle: "Identity confirmed", icon: DashboardIcons.verified, color: "emerald", sparkline: verifiedSpark, trend: verifiedSpark ? computeTrendDelta(verifiedSpark) : undefined },
        { title: "Active Alumni", value: formatKpiValue(kpis?.activeAlumni), secondaryValue: pct(kpis?.activeAlumni, ah?.total), subtitle: "Logged into profile ≥1 time", icon: DashboardIcons.users, color: "emerald", sparkline: activeSpark, trend: activeSpark ? computeTrendDelta(activeSpark) : undefined },
      ],
    },
    {
      id: "alumni-categories",
      label: "Alumni Categories",
      description: "Tier distribution A+ through D",
      layout: "columns",
      items: [
        { title: "A+", value: formatKpiValue(ah?.category?.aPlus), subtitle: "Highest distinction", icon: DashboardIcons.star, color: "violet", sparkline: trends ? buildSparklineSeries(trends, "A_plus") : undefined },
        { title: "A", value: formatKpiValue(ah?.category?.a), subtitle: "Distinguished alumni", icon: DashboardIcons.star, color: "sky", sparkline: trends ? buildSparklineSeries(trends, "A") : undefined },
        { title: "B", value: formatKpiValue(ah?.category?.b), subtitle: "Active contributors", icon: DashboardIcons.star, color: "orange" },
        { title: "C", value: formatKpiValue(ah?.category?.c), subtitle: "Regular members", icon: DashboardIcons.star, color: "slate" },
        { title: "D", value: formatKpiValue(ah?.category?.d), subtitle: "Basic tier", icon: DashboardIcons.star, color: "rose" },
      ],
    },
    {
      id: "engagement-chapters",
      label: "Engagement & Chapters",
      description: "Networking, events & honor cards",
      items: [
        { title: "Engagements", value: formatKpiValue(kpis?.totalEngagements), subtitle: timeRange, icon: DashboardIcons.users, color: "violet" },
        { title: "Event Participation", value: formatKpiValue(kpis?.totalEventsMeetups), subtitle: timeRange, icon: DashboardIcons.chart, color: "rose" },
        { title: "Chapters", value: formatKpiValue((chapters?.nationalChapters ?? 0) + (chapters?.internationalChapters ?? 0)), subtitle: `Members: ${formatKpiValue(chapters?.members)}`, icon: DashboardIcons.users, color: "violet" },
        { title: "Associations", value: formatKpiValue(chapters?.associationMembers), subtitle: `${formatKpiValue(chapters?.associations)} associations`, icon: DashboardIcons.users, color: "amber" },
        { title: "Honor Cards Issued", value: formatKpiValue(cards?.delivered), subtitle: "Delivered", icon: DashboardIcons.card, color: "amber" },
      ],
    },
    {
      id: "career-benefits",
      label: "Career & Benefits",
      description: "Placement, jobs, scholarships & perks",
      items: [
        { title: "Placement Rate", value: pct(employed, placementDenom), subtitle: "Employed / tracked", icon: DashboardIcons.briefcase, color: "sky" },
        { title: "Jobs Posted", value: formatKpiValue(kpis?.jobsPosted), subtitle: "All-time", icon: DashboardIcons.briefcase, color: "sky" },
        { title: "Scholarships Processed", value: formatKpiValue(kpis?.scholarshipsProcessed), subtitle: "Approved + not-approved", icon: DashboardIcons.briefcase, color: "amber" },
        { title: "Active Benefits", value: formatKpiValue(kpis?.activeBenefitsDiscounts), subtitle: "Memberships active", icon: DashboardIcons.gift, color: "emerald" },
      ],
    },
    buildTrainedAdminGroup(trainedAdmins),
    buildTransitionVelocityGroup(transitionVelocity),
  ];
}

/** Flat list for callers that still expect a single array. */
export function buildAllKpis(
  data: ManagementDashboardPayload | undefined,
  trends: AlumniTrendPoint[] | undefined
): KpiConfigItem[] {
  return buildAllKpiGroups(data, trends).flatMap((g) => g.items);
}
