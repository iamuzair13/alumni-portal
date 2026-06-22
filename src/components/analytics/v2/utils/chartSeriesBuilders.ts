import type { ManagementDashboardPayload, ManagementDashboardSectionA, TrainedFacultyAdminsPayload } from "@/lib/analytics/management-dashboard";
import type { AnalyticsChartType, ChartSeriesPoint, KpiConfigGroup } from "./kpiConfig";
import { KPI_COLOR_HEX, colorAt } from "../charts/chartColors";
import { getPeriodColumnLabels } from "./periodColumnLabels";

function pctLocal(numerator: number | null | undefined, denominator: number | null | undefined): string {
  if (!denominator || denominator <= 0 || numerator == null) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export type ChartGroupMeta = {
  chartType: AnalyticsChartType;
  chartSeries: ChartSeriesPoint[];
  chartSeriesSecondary?: ChartSeriesPoint[];
  chartMeta?: { primaryLabel?: string; secondaryLabel?: string };
  insight?: string;
  collapsible?: boolean;
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function topPoint(series: ChartSeriesPoint[]): ChartSeriesPoint | undefined {
  return [...series].sort((a, b) => b.value - a.value)[0];
}

function totalOf(series: ChartSeriesPoint[]): number {
  return series.reduce((sum, p) => sum + p.value, 0);
}

export function facultyRegistrationsChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const rows = [...(data?.sectionA?.facultyRows ?? [])].sort((a, b) => b.registrations - a.registrations);
  const chartSeries: ChartSeriesPoint[] = rows.map((r, i) => ({
    label: r.faculty || "Unknown",
    value: num(r.registrations),
    color: colorAt(i),
  }));
  const total = totalOf(chartSeries);
  const top = topPoint(chartSeries);
  return {
    chartType: "treemap",
    chartSeries,
    insight: top && total > 0 ? `Top: ${top.label} — ${pctLocal(top.value, total)}` : "No faculty data",
  };
}

export function occupationChart(
  data: ManagementDashboardPayload | undefined,
  options?: { verifiedOnly?: boolean }
): ChartGroupMeta {
  const oc = options?.verifiedOnly
    ? data?.sectionA?.verifiedCurrentOccupation ?? data?.sectionA?.currentOccupation
    : data?.sectionA?.currentOccupation;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Employed", value: num(oc?.employed), color: KPI_COLOR_HEX.emerald },
    { label: "Self-employed", value: num(oc?.selfEmployed), color: KPI_COLOR_HEX.sky },
    { label: "Unemployed (searching)", value: num(oc?.unemployedSearching), color: KPI_COLOR_HEX.amber },
    { label: "Unemployed (by choice)", value: num(oc?.unemployedByChoice), color: KPI_COLOR_HEX.orange },
    { label: "Other", value: num(oc?.other), color: KPI_COLOR_HEX.slate },
  ].filter((p) => p.value > 0);
  return {
    chartType: "donut",
    chartSeries: chartSeries.length ? chartSeries : [{ label: "No data", value: 0, color: KPI_COLOR_HEX.slate }],
    insight: oc?.employed != null ? `${num(oc.employed).toLocaleString()} employed alumni` : "—",
  };
}

const PROVINCE_MAP_KEYS: Record<string, string> = {
  Punjab: "PK-PB",
  Sindh: "PK-SD",
  KPK: "PK-KP",
  Balochistan: "PK-BA",
  Islamabad: "PK-IS",
  AJK: "PK-JK",
  GB: "PK-GB",
};

export function provinceLocationChart(
  data: ManagementDashboardPayload | undefined,
  options?: { verifiedOnly?: boolean }
): ChartGroupMeta {
  const pl = options?.verifiedOnly
    ? data?.sectionA?.verifiedProvinceLocation ?? data?.sectionA?.provinceLocation
    : data?.sectionA?.provinceLocation;
  const regions = [
    { title: "Punjab", value: pl?.punjab },
    { title: "Islamabad", value: pl?.islamabad },
    { title: "KPK", value: pl?.kpk },
    { title: "Sindh", value: pl?.sindh },
    { title: "AJK", value: pl?.ajk },
    { title: "GB", value: pl?.gb },
    { title: "Balochistan", value: pl?.balochistan },
    { title: "Overseas", value: pl?.overseas },
    { title: "Other", value: pl?.other },
  ];
  const chartSeries: ChartSeriesPoint[] = regions.map((r, i) => ({
    label: r.title,
    value: num(r.value),
    color: colorAt(i),
    meta: { geoId: PROVINCE_MAP_KEYS[r.title] ?? r.title },
  }));
  const total = totalOf(chartSeries);
  const top = topPoint(chartSeries);
  return {
    chartType: "geo",
    chartSeries,
    insight: top && total > 0 ? `Largest: ${top.label} (${pctLocal(top.value, total)})` : "—",
  };
}

export function transitionVelocityEarlyCount(
  tv: ManagementDashboardSectionA["transitionVelocity"] | undefined
): number {
  return (
    num(tv?.beforeGraduation) + num(tv?.immediateAfterGraduation) + num(tv?.within3Months)
  );
}

export function transitionVelocityTrackedTotal(
  tv: ManagementDashboardSectionA["transitionVelocity"] | undefined
): number {
  return (
    num(tv?.beforeGraduation) +
    num(tv?.immediateAfterGraduation) +
    num(tv?.within3Months) +
    num(tv?.within6Months) +
    num(tv?.after6Months) +
    num(tv?.unknown)
  );
}

/** Early transition % among alumni with a recorded timing response only. */
export function transitionVelocityScore(
  tv: ManagementDashboardSectionA["transitionVelocity"] | undefined
): number {
  const tracked = transitionVelocityTrackedTotal(tv);
  if (tracked <= 0) return 0;
  return Math.round((transitionVelocityEarlyCount(tv) / tracked) * 100);
}

export function transitionVelocityChart(
  tv: ManagementDashboardSectionA["transitionVelocity"] | undefined,
  totalAlumni?: number | null
): ChartGroupMeta {
  const buckets = [
    { label: "Before graduation", value: num(tv?.beforeGraduation) },
    { label: "Immediate after grad", value: num(tv?.immediateAfterGraduation) },
    { label: "Within 3 months", value: num(tv?.within3Months) },
    { label: "Within 6 months", value: num(tv?.within6Months) },
    { label: "After 6 months", value: num(tv?.after6Months) },
    { label: "Other / unknown", value: num(tv?.unknown) },
  ];
  const trackedTotal = buckets.reduce((s, b) => s + b.value, 0);
  const alumniTotal = num(totalAlumni);
  const notProvided = alumniTotal > trackedTotal ? alumniTotal - trackedTotal : 0;
  const early = transitionVelocityEarlyCount(tv);

  const chartSeries: ChartSeriesPoint[] = [
    ...buckets.filter((b) => b.value > 0).map((b, i) => ({ ...b, color: colorAt(i) })),
    ...(notProvided > 0
      ? [{ label: "Not provided", value: notProvided, color: KPI_COLOR_HEX.slate }]
      : []),
  ];

  const insight =
    alumniTotal > 0
      ? `Early transition: ${pctLocal(early, alumniTotal)} of ${alumniTotal.toLocaleString()} alumni`
      : trackedTotal > 0
        ? `Early transition rate: ${pctLocal(early, trackedTotal)} (tracked only)`
        : "—";

  return {
    chartType: "funnel",
    chartSeries: chartSeries.length
      ? chartSeries
      : [{ label: "No data", value: 0, color: KPI_COLOR_HEX.slate }],
    insight,
  };
}

export function trainedAdminChart(trained: TrainedFacultyAdminsPayload | undefined): ChartGroupMeta {
  const byFaculty = [...(trained?.byFaculty ?? [])].sort((a, b) => b.count - a.count);
  const chartSeries: ChartSeriesPoint[] = byFaculty.map((r, i) => ({
    label: r.faculty,
    value: r.count,
    color: colorAt(i),
  }));
  const top = topPoint(chartSeries);
  return {
    chartType: "bar",
    chartSeries: chartSeries.length ? chartSeries : [{ label: "No data", value: 0 }],
    insight: top ? `${num(trained?.total).toLocaleString()} admins · Top: ${top.label}` : "No admin data",
  };
}

export function chaptersAssociationsChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const chapters = data?.sectionB?.chaptersAssociations;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "National chapters", value: num(chapters?.nationalChapters), color: KPI_COLOR_HEX.indigo },
    { label: "International chapters", value: num(chapters?.internationalChapters), color: KPI_COLOR_HEX.emerald },
    { label: "Associations", value: num(chapters?.associations), color: KPI_COLOR_HEX.amber },
    { label: "Members", value: num(chapters?.members), color: KPI_COLOR_HEX.sky },
    { label: "Leaders", value: num(chapters?.leadersAppointed), color: KPI_COLOR_HEX.violet },
    { label: "Meetups", value: num(chapters?.meetupsTotal), color: KPI_COLOR_HEX.rose },
  ];
  return {
    chartType: "bar",
    chartSeries,
    insight: `${num(chapters?.nationalChapters)} national · ${num(chapters?.internationalChapters)} international`,
  };
}

export function honorCardsChart(
  data: ManagementDashboardPayload | undefined,
  options?: { verifiedOnly?: boolean }
): ChartGroupMeta {
  const cards = options?.verifiedOnly
    ? data?.sectionB?.verifiedCardsStatus ?? data?.sectionB?.cardsStatus
    : data?.sectionB?.cardsStatus;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Applied", value: num(cards?.applied), color: KPI_COLOR_HEX.slate },
    { label: "Under review", value: num(cards?.review), color: KPI_COLOR_HEX.amber },
    { label: "On-hold", value: num(cards?.onHold), color: KPI_COLOR_HEX.rose },
    { label: "Under printing", value: num(cards?.underPrinting), color: KPI_COLOR_HEX.sky },
    { label: "Ready", value: num(cards?.readyForDelivery), color: KPI_COLOR_HEX.indigo },
    { label: "Delivered", value: num(cards?.delivered), color: KPI_COLOR_HEX.emerald },
  ];
  return {
    chartType: "funnel",
    chartSeries,
    insight: `${num(cards?.delivered).toLocaleString()} delivered`,
  };
}

export function engagementActivitiesChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const { primary, secondary } = getPeriodColumnLabels(data);
  const activities = data?.sectionB?.activities;
  const rows = [
    { label: "Mentorship", quarter: num(activities?.mentorshipSessions?.quarter), ytd: num(activities?.mentorshipSessions?.ytd) },
    { label: "Seminars", quarter: num(activities?.seminarsParticipation?.quarter), ytd: num(activities?.seminarsParticipation?.ytd) },
    { label: "Conferences", quarter: num(activities?.conferencesParticipation?.quarter), ytd: num(activities?.conferencesParticipation?.ytd) },
    { label: "Alumni talks", quarter: num(activities?.alumniTalks?.quarter), ytd: num(activities?.alumniTalks?.ytd) },
    { label: "High achievers", quarter: num(activities?.highAchieversRecognition?.quarter), ytd: num(activities?.highAchieversRecognition?.ytd) },
    { label: "Wellbeing", quarter: num(activities?.wellbeingSupport?.quarter), ytd: num(activities?.wellbeingSupport?.ytd) },
  ];
  const chartSeries = rows.map((r, i) => ({ label: r.label, value: r.quarter, color: colorAt(i), meta: { ytd: r.ytd } }));
  const top = topPoint(chartSeries);
  return {
    chartType: "heatmap",
    chartSeries,
    chartMeta: { primaryLabel: primary, secondaryLabel: secondary },
    insight: top ? `Top: ${top.label} (${top.value.toLocaleString()})` : "—",
  };
}

export function publicationsChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const { primary, secondary } = getPeriodColumnLabels(data);
  const pubs = data?.sectionB?.publications;
  const rows = [
    { label: "Success stories", quarter: num(pubs?.successStoriesQuarter), ytd: num(pubs?.successStoriesYtd) },
    { label: "Newsletters", quarter: num(pubs?.newslettersQuarter), ytd: num(pubs?.newslettersYtd) },
    { label: "Surveys", quarter: num(pubs?.surveysConducted), ytd: num(pubs?.surveysConducted) },
  ];
  return {
    chartType: "grouped-bar",
    chartSeries: rows.map((r, i) => ({ label: r.label, value: r.quarter, color: colorAt(i) })),
    chartSeriesSecondary: rows.map((r, i) => ({ label: r.label, value: r.ytd, color: colorAt(i) })),
    chartMeta: { primaryLabel: primary, secondaryLabel: secondary },
    insight: `${num(pubs?.successStoriesPublished).toLocaleString()} success stories published`,
  };
}

export function careerServicesChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const { primary, secondary } = getPeriodColumnLabels(data);
  const career = data?.sectionC?.career;
  const rows = [
    { label: "Recruitment", quarter: num(career?.recruitmentDrives?.quarter), ytd: num(career?.recruitmentDrives?.ytd) },
    { label: "Jobs (UOL)", quarter: num(career?.jobsPostedUol?.quarter), ytd: num(career?.jobsPostedUol?.ytd) },
    { label: "Jobs (other)", quarter: num(career?.jobsPostedOtherEmployers?.quarter), ytd: num(career?.jobsPostedOtherEmployers?.ytd) },
    { label: "Startups", quarter: num(career?.startupsSupport?.quarter), ytd: num(career?.startupsSupport?.ytd) },
    { label: "Upskill", quarter: num(career?.upskillCourses?.quarter), ytd: num(career?.upskillCourses?.ytd) },
  ];
  const chartSeries = rows.map((r, i) => ({ label: r.label, value: r.quarter, color: colorAt(i) }));
  const chartSeriesSecondary = rows.map((r, i) => ({ label: r.label, value: r.ytd, color: colorAt(i) }));
  const top = topPoint(chartSeries);
  return {
    chartType: "stacked-bar",
    chartSeries,
    chartSeriesSecondary,
    chartMeta: { primaryLabel: primary, secondaryLabel: secondary },
    insight: top ? `Top: ${top.label}` : "—",
  };
}

export function scholarshipsChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const scholarships = data?.sectionC?.scholarships;
  const rows = [
    { label: "Kinship", applied: num(scholarships?.kinship?.applied), processed: num(scholarships?.kinship?.processed) },
    { label: "Masters / PhD", applied: num(scholarships?.mastersPhd?.applied), processed: num(scholarships?.mastersPhd?.processed) },
    { label: "IQ programs", applied: num(scholarships?.iqPrograms?.applied), processed: num(scholarships?.iqPrograms?.processed) },
  ];
  const totalProcessed = rows.reduce((s, r) => s + r.processed, 0);
  return {
    chartType: "stacked-bar",
    chartSeries: rows.map((r, i) => ({ label: r.label, value: r.applied, color: colorAt(i) })),
    chartSeriesSecondary: rows.map((r, i) => ({ label: r.label, value: r.processed, color: colorAt(i) })),
    chartMeta: { primaryLabel: "Applied", secondaryLabel: "Processed" },
    insight: `${totalProcessed.toLocaleString()} processed total`,
  };
}

export function membershipsChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const m = data?.sectionD?.memberships;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Gym", value: num(m?.gymDiscountActive), color: KPI_COLOR_HEX.emerald },
    { label: "Pool", value: num(m?.swimmingPoolDiscountActive), color: KPI_COLOR_HEX.sky },
    { label: "Free gym", value: num(m?.freeGymThreeMonth), color: KPI_COLOR_HEX.indigo },
    { label: "Free pool", value: num(m?.freePoolThreeMonth), color: KPI_COLOR_HEX.violet },
    { label: "Qalander", value: num(m?.qalanderClub), color: KPI_COLOR_HEX.amber },
    { label: "Healthcare", value: num(m?.healthcareDiscounts), color: KPI_COLOR_HEX.rose },
    { label: "Stickers", value: num(m?.vehicleStickers), color: KPI_COLOR_HEX.orange },
  ];
  const top = topPoint(chartSeries);
  return {
    chartType: "bar",
    chartSeries,
    insight: top ? `Top perk: ${top.label}` : "—",
  };
}

export function discountCategoriesChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const d = data?.sectionD?.discountCategories;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Dining", value: num(d?.diningAndCafes), color: KPI_COLOR_HEX.amber },
    { label: "Retail", value: num(d?.retailAndShopping), color: KPI_COLOR_HEX.indigo },
    { label: "Travel", value: num(d?.travelAndLeisure), color: KPI_COLOR_HEX.sky },
    { label: "Health", value: num(d?.healthAndWellness), color: KPI_COLOR_HEX.emerald },
    { label: "Professional", value: num(d?.professionalServices), color: KPI_COLOR_HEX.violet },
    { label: "Financial", value: num(d?.financialServices), color: KPI_COLOR_HEX.rose },
  ].filter((p) => p.value > 0);
  const top = topPoint(chartSeries);
  return {
    chartType: "donut",
    chartSeries: chartSeries.length ? chartSeries : [{ label: "No data", value: 0, color: KPI_COLOR_HEX.slate }],
    insight: top ? `Top: ${top.label}` : "—",
  };
}

export function alumniCategoriesChart(
  data: ManagementDashboardPayload | undefined,
  options?: { verifiedOnly?: boolean }
): ChartGroupMeta {
  const cat = options?.verifiedOnly
    ? data?.alumniHeadline?.verifiedCategory ?? data?.alumniHeadline?.category
    : data?.alumniHeadline?.category;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "A+", value: num(cat?.aPlus), color: KPI_COLOR_HEX.violet },
    { label: "A", value: num(cat?.a), color: KPI_COLOR_HEX.sky },
    { label: "B", value: num(cat?.b), color: KPI_COLOR_HEX.orange },
    { label: "C", value: num(cat?.c), color: KPI_COLOR_HEX.slate },
    { label: "D", value: num(cat?.d), color: KPI_COLOR_HEX.rose },
  ].filter((p) => p.value > 0);
  const total = totalOf(chartSeries);
  const top = topPoint(chartSeries);
  return {
    chartType: "donut",
    chartSeries: chartSeries.length ? chartSeries : [{ label: "No data", value: 0 }],
    insight: top && total > 0 ? `Top tier: ${top.label} (${pctLocal(top.value, total)})` : "—",
  };
}

export function engagementChaptersRadarChart(data: ManagementDashboardPayload | undefined, timeRange: string): ChartGroupMeta {
  const kpis = data?.kpis;
  const chapters = data?.sectionB?.chaptersAssociations;
  const cards = data?.sectionB?.cardsStatus;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Engagements", value: num(kpis?.totalEngagements) },
    { label: "Events", value: num(kpis?.totalEventsMeetups) },
    { label: "Chapters", value: num(chapters?.nationalChapters) + num(chapters?.internationalChapters) },
    { label: "Associations", value: num(chapters?.associationMembers) },
    { label: "Honor cards", value: num(cards?.delivered) },
  ];
  const top = topPoint(chartSeries);
  return {
    chartType: "radar",
    chartSeries,
    insight: top ? `Highest: ${top.label} (${top.value.toLocaleString()}) · ${timeRange}` : timeRange,
  };
}

export function careerBenefitsChart(
  employed: number,
  placementDenom: number,
  data: ManagementDashboardPayload | undefined
): ChartGroupMeta {
  const kpis = data?.kpis;
  const placementPct =
    placementDenom > 0 ? Math.round((employed / placementDenom) * 100) : 0;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Placement %", value: placementPct, color: KPI_COLOR_HEX.sky },
    { label: "Jobs Posted", value: num(kpis?.jobsPosted), color: KPI_COLOR_HEX.indigo },
    {
      label: "Scholarships",
      value: num(kpis?.scholarshipsProcessed),
      color: KPI_COLOR_HEX.amber,
    },
    {
      label: "Active Benefits",
      value: num(kpis?.activeBenefitsDiscounts),
      color: KPI_COLOR_HEX.emerald,
    },
  ].filter((p) => p.value > 0);
  return {
    chartType: "bar",
    chartSeries: chartSeries.length
      ? chartSeries
      : [{ label: "No data", value: 0, color: KPI_COLOR_HEX.slate }],
    insight: placementDenom > 0 ? `Placement rate: ${pctLocal(employed, placementDenom)}` : "—",
    collapsible: true,
  };
}

export function alumniOverviewChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const ah = data?.alumniHeadline;
  const kpis = data?.kpis;
  const chartSeries: ChartSeriesPoint[] = [
    { label: "Total Alumni", value: num(kpis?.totalAlumni), color: KPI_COLOR_HEX.blue },
    { label: "Registrations", value: num(kpis?.totalRegistrations), color: KPI_COLOR_HEX.indigo },
    { label: "Verified", value: num(ah?.verified), color: KPI_COLOR_HEX.emerald },
    { label: "Active", value: num(kpis?.activeAlumni), color: KPI_COLOR_HEX.sky },
  ].filter((p) => p.value > 0);
  return {
    chartType: "bar",
    chartSeries: chartSeries.length
      ? chartSeries
      : [{ label: "No data", value: 0, color: KPI_COLOR_HEX.slate }],
    insight:
      ah?.total && ah.total > 0
        ? `Verification ${pctLocal(ah.verified, ah.total)} · Engagement ${pctLocal(kpis?.activeAlumni, ah.total)}`
        : undefined,
    collapsible: false,
  };
}

export function giveBackChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const giveBack = data?.sectionC?.giveBackFinancialAssistance;
  const amount = typeof giveBack === "number" ? giveBack : 0;
  return {
    chartType: "bar",
    chartSeries: [
      {
        label: "Financial Assistance",
        value: amount,
        color: KPI_COLOR_HEX.rose,
        meta: { formatted: amount > 0 ? `Rs. ${amount.toLocaleString()}` : "—" },
      },
    ],
    insight:
      typeof giveBack === "number"
        ? `Rs. ${giveBack.toLocaleString()} disbursed`
        : "No disbursement data yet",
  };
}

export function merchantPartnershipsChart(data: ManagementDashboardPayload | undefined): ChartGroupMeta {
  const merchants = data?.sectionD?.merchants ?? [];
  const chartSeries: ChartSeriesPoint[] = merchants.map((m, i) => {
    const pctMatch = m.discount?.match(/(\d+(?:\.\d+)?)/);
    const value = pctMatch ? parseFloat(pctMatch[1]) : 1;
    const label = m.merchant.length > 28 ? `${m.merchant.slice(0, 27)}…` : m.merchant;
    return { label, value, color: colorAt(i), meta: { discount: m.discount, reference: m.reference } };
  });
  const top = topPoint(chartSeries);
  return {
    chartType: "bar",
    chartSeries: chartSeries.length ? chartSeries : [{ label: "No partners", value: 0, color: KPI_COLOR_HEX.slate }],
    insight: top
      ? `${merchants.length} partner${merchants.length === 1 ? "" : "s"} · Top: ${top.label}`
      : `${merchants.length} partner${merchants.length === 1 ? "" : "s"}`,
  };
}

export function mergeChartMeta(
  group: Pick<KpiConfigGroup, "id" | "label" | "description" | "items">,
  meta: ChartGroupMeta
): KpiConfigGroup {
  return { ...group, ...meta, collapsible: meta.collapsible ?? true };
}

