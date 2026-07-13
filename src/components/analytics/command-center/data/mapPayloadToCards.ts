import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import { stripFacultyOfPrefix } from "../utils/facultyLabels";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
import { KPI_COLOR_HEX } from "@/components/analytics/v2/charts/chartColors";
import {
  getPeriodColumnLabels,
  resolveQuarterLabel,
} from "@/components/analytics/v2/utils/periodColumnLabels";
import {
  alumniCategoriesChart,
  alumniOverviewChart,
  careerBenefitsChart,
  careerServicesChart,
  chaptersAssociationsChart,
  discountCategoriesChart,
  engagementActivitiesChart,
  honorCardsChart,
  membershipsChart,
  merchantPartnershipsChart,
  occupationChart,
  provinceLocationChart,
  publicationsChart,
  scholarshipsChart,
  transitionVelocityChart,
  transitionVelocityEarlyCount,
  transitionVelocityScore,
  transitionVelocityTrackedTotal,
  trainedAdminChart,
} from "@/components/analytics/v2/utils/chartSeriesBuilders";

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export type VerifiedAlumniMapOptions = {
  /** When true, metrics use tbl_alumni.verify = 'true' aggregates only */
  verifiedOnly?: boolean;
};

export function mapSparklineData(trends: AlumniTrendPoint[] | undefined): number[] {
  return (trends ?? []).map((t) => t.total);
}

export function mapAlumniOverview(data: ManagementDashboardPayload | undefined) {
  const ah = data?.alumniHeadline;
  const kpis = data?.kpis;
  const total = num(ah?.total ?? kpis?.totalAlumni);
  const active = num(kpis?.activeAlumni);
  const verified = num(ah?.verified);
  const chart = alumniOverviewChart(data);
  const headlineBars: ChartSeriesPoint[] = [
    { label: "Total", value: total, color: "#6366f1" },
    { label: "Verified", value: verified, color: "#10b981" },
    { label: "Active", value: active, color: "#34d399" },
  ];
  return {
    primaryValue: total,
    secondaryLabel: `${active.toLocaleString()} active · ${verified.toLocaleString()} verified`,
    headlineBars,
    chartSeries: chart.chartSeries,
    insight: chart.insight,
    facultyRows: data?.sectionA?.facultyRows ?? [],
  };
}

export function mapAlumniCategories(
  data: ManagementDashboardPayload | undefined,
  options?: VerifiedAlumniMapOptions
) {
  const chart = alumniCategoriesChart(data, options);
  const cat = options?.verifiedOnly
    ? data?.alumniHeadline?.verifiedCategory ?? data?.alumniHeadline?.category
    : data?.alumniHeadline?.category;
  return {
    chartSeries: chart.chartSeries,
    rows: [
      { tier: "A+", count: num(cat?.aPlus) },
      { tier: "A", count: num(cat?.a) },
      { tier: "B", count: num(cat?.b) },
      { tier: "C", count: num(cat?.c) },
      { tier: "D", count: num(cat?.d) },
    ],
  };
}

export function mapAlumniOccupation(
  data: ManagementDashboardPayload | undefined,
  options?: VerifiedAlumniMapOptions
) {
  const chart = occupationChart(data, options);
  const oc = options?.verifiedOnly
    ? data?.sectionA?.verifiedCurrentOccupation ?? data?.sectionA?.currentOccupation
    : data?.sectionA?.currentOccupation;
  return {
    chartSeries: chart.chartSeries,
    rows: [
      { status: "Employed", count: num(oc?.employed) },
      { status: "Self-employed", count: num(oc?.selfEmployed) },
      { status: "Unemployed (searching)", count: num(oc?.unemployedSearching) },
      { status: "Unemployed (by choice)", count: num(oc?.unemployedByChoice) },
      { status: "Pursuing higher education", count: num(oc?.other) },
    ],
  };
}

export function mapHonorCards(
  data: ManagementDashboardPayload | undefined,
  options?: VerifiedAlumniMapOptions
) {
  const cards = options?.verifiedOnly
    ? data?.sectionB?.verifiedCardsStatus ?? data?.sectionB?.cardsStatus
    : data?.sectionB?.cardsStatus;
  const chart = honorCardsChart(data, options);
  return {
    total: num(cards?.totalCards),
    delivered: num(cards?.delivered),
    chartSeries: chart.chartSeries,
    badges: [
      { label: "Applied", count: num(cards?.applied) },
      { label: "Review", count: num(cards?.review) },
      { label: "On Hold", count: num(cards?.onHold) },
      { label: "Printing", count: num(cards?.underPrinting) },
      { label: "Ready", count: num(cards?.readyForDelivery) },
      { label: "Delivered", count: num(cards?.delivered) },
    ],
  };
}

export function mapTransitionVelocity(
  data: ManagementDashboardPayload | undefined,
  options?: VerifiedAlumniMapOptions
) {
  const tv = options?.verifiedOnly
    ? data?.sectionA?.verifiedTransitionVelocity ?? data?.sectionA?.transitionVelocity
    : data?.sectionA?.transitionVelocity;
  const totalAlumni = options?.verifiedOnly
    ? num(data?.alumniHeadline?.verified)
    : num(data?.alumniHeadline?.total ?? data?.kpis?.totalAlumni);
  const chart = transitionVelocityChart(tv, totalAlumni);
  const score = transitionVelocityScore(tv);
  const buckets = {
    beforeGraduation: num(tv?.beforeGraduation),
    immediateAfterGraduation: num(tv?.immediateAfterGraduation),
    within3Months: num(tv?.within3Months),
    within6Months: num(tv?.within6Months),
    after6Months: num(tv?.after6Months),
    unknown: num(tv?.unknown),
  };
  const trackedTotal = transitionVelocityTrackedTotal(tv);
  const earlyCount = transitionVelocityEarlyCount(tv);
  const rows = [
    { label: "Before grad", short: "Pre", count: buckets.beforeGraduation, color: KPI_COLOR_HEX.emerald },
    { label: "Grad", short: "Grad", count: buckets.immediateAfterGraduation, color: KPI_COLOR_HEX.sky },
    { label: "≤3 mo", short: "3 Months", count: buckets.within3Months, color: KPI_COLOR_HEX.violet },
    { label: "≤6 mo", short: "6 Months", count: buckets.within6Months, color: KPI_COLOR_HEX.amber },
    { label: ">6 mo", short: "6+ Months", count: buckets.after6Months, color: KPI_COLOR_HEX.orange },
  ];
  const timingBars = rows.map(({ label, count, color }) => ({ label, value: count, color }));

  return {
    score,
    earlyCount,
    trackedTotal,
    buckets,
    rows,
    timingBars,
    chartSeries: chart.chartSeries,
    insight: chart.insight,
    totalAlumni,
  };
}

function titleCaseRegion(key: string): string {
  if (!key) return "Unknown";
  // Handle known acronyms and bucket names
  const special: Record<string, string> = {
    kpk: "KPK",
    ajk: "AJK",
    gb: "GB",
    other: "Other",
    others: "Others",
    overseas: "Overseas",
  };
  const lower = key.trim().toLowerCase();
  if (special[lower]) return special[lower];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function mapLocation(
  data: ManagementDashboardPayload | undefined,
  options?: VerifiedAlumniMapOptions
) {
  const chart = provinceLocationChart(data, options);

  // Prefer exact distinct province rows from the backend so the UI shows real
  // database values instead of an aggregated "Other" bucket.
  const exactRows = options?.verifiedOnly
    ? data?.sectionA?.verifiedProvinceLocationRows ?? data?.sectionA?.provinceLocationRows
    : data?.sectionA?.provinceLocationRows;

  if (exactRows && exactRows.length > 0) {
    return {
      chartSeries: chart.chartSeries,
      rows: exactRows.map((r) => ({
        region: titleCaseRegion(r.region),
        count: num(r.count),
      })),
    };
  }

  // Fallback for older payloads that don't yet include provinceLocationRows.
  const pl = options?.verifiedOnly
    ? data?.sectionA?.verifiedProvinceLocation ?? data?.sectionA?.provinceLocation
    : data?.sectionA?.provinceLocation;

  const rows = pl
    ? Object.entries(pl)
        .filter(([, count]) => count != null)
        .map(([key, count]) => ({
          region: titleCaseRegion(key),
          count: num(count),
        }))
    : [];

  return {
    chartSeries: chart.chartSeries,
    rows,
  };
}

export function mapEngagementsChapters(data: ManagementDashboardPayload | undefined) {
  const ch = data?.sectionB?.chaptersAssociations;
  const chart = chaptersAssociationsChart(data);
  const nationalRows = ch?.nationalChapterRows ?? [];
  const internationalRows = ch?.internationalChapterRows ?? [];
  const nationalMembers =
    ch?.nationalMembers != null
      ? num(ch.nationalMembers)
      : nationalRows.reduce((sum, row) => sum + num(row.members), 0);
  const internationalMembers =
    ch?.internationalMembers != null
      ? num(ch.internationalMembers)
      : internationalRows.reduce((sum, row) => sum + num(row.members), 0);
  return {
    national: num(ch?.nationalChapters),
    international: num(ch?.internationalChapters),
    nationalMembers,
    internationalMembers,
    members: num(ch?.members),
    meetupsYtd: num(ch?.meetupsYtd),
    nationalRows,
    internationalRows,
    chartSeries: chart.chartSeries,
    summaryChart: {
      national: [{ label: "Alumni", value: nationalMembers, color: "#a78bfa" }],
      international: [{ label: "Alumni", value: internationalMembers, color: "#34d399" }],
    },
  };
}

export function mapCareerBenefits(data: ManagementDashboardPayload | undefined) {
  const oc = data?.sectionA?.currentOccupation;
  const employed = num(oc?.employed) + num(oc?.selfEmployed);
  const denom = employed + num(oc?.unemployedSearching) + num(oc?.unemployedByChoice) + num(oc?.other);
  const chart = careerBenefitsChart(employed, denom, data);
  const career = careerServicesChart(data);
  const scholarships = scholarshipsChart(data);
  const quarterLabel = resolveQuarterLabel(data);
  const jobsData = data?.sectionC?.jobs;
  const sc = data?.sectionC?.scholarships;
  const jobs = {
    total: num(jobsData?.total),
    uol: num(jobsData?.uol),
    other: num(jobsData?.other),
    quarter: num(jobsData?.quarter),
    ytd: num(jobsData?.ytd),
    categoryRows: jobsData?.categoryRows ?? [],
  };
  const scholarshipTotals = {
    kinshipApplied: num(sc?.kinship?.applied),
    kinshipApproved: num(sc?.kinship?.approved),
    kinshipProcessed: num(sc?.kinship?.processed),
    mastersApplied: num(sc?.mastersPhd?.applied),
    mastersApproved: num(sc?.mastersPhd?.approved),
    mastersProcessed: num(sc?.mastersPhd?.processed),
    iqApplied: num(sc?.iqPrograms?.applied),
    iqApproved: num(sc?.iqPrograms?.approved),
    iqProcessed: num(sc?.iqPrograms?.processed),
  };
  const scholarshipsApplied =
    num(data?.kpis?.scholarshipsApplied) > 0
      ? num(data?.kpis?.scholarshipsApplied)
      : scholarshipTotals.kinshipApplied +
        scholarshipTotals.mastersApplied +
        scholarshipTotals.iqApplied;
  const scholarshipsApproved =
    num(data?.kpis?.scholarshipsApproved) > 0
      ? num(data?.kpis?.scholarshipsApproved)
      : scholarshipTotals.kinshipApproved +
        scholarshipTotals.mastersApproved +
        scholarshipTotals.iqApproved;
  const scholarshipsProcessed =
    scholarshipTotals.kinshipProcessed +
    scholarshipTotals.mastersProcessed +
    scholarshipTotals.iqProcessed;
  const scholarshipRows = [
    {
      type: "Kinship",
      short: "Kin",
      applied: scholarshipTotals.kinshipApplied,
      approved: scholarshipTotals.kinshipApproved,
      color: KPI_COLOR_HEX.indigo,
    },
    {
      type: "Masters / PhD",
      short: "MS",
      applied: scholarshipTotals.mastersApplied,
      approved: scholarshipTotals.mastersApproved,
      color: KPI_COLOR_HEX.violet,
    },
    {
      type: "IQ programs",
      short: "IQ",
      applied: scholarshipTotals.iqApplied,
      approved: scholarshipTotals.iqApproved,
      color: KPI_COLOR_HEX.amber,
    },
  ];

  return {
    chart,
    career,
    scholarships,
    jobs,
    quarterLabel,
    facultyScholarshipRows: data?.sectionC?.facultyScholarshipRows ?? [],
    scholarshipTotals,
    scholarshipRows,
    scholarshipsApplied,
    scholarshipsApproved,
    scholarshipsProcessed,
    scholarshipsPending: Math.max(0, scholarshipsApplied - scholarshipsProcessed),
    careerServices: data?.sectionC?.career,
    kpis: data?.kpis,
  };
}

export function mapMeetupsEvents(data: ManagementDashboardPayload | undefined) {
  const em = data?.sectionB?.eventsMeetups;
  const quarterLabel = resolveQuarterLabel(data);

  const events = {
    total: num(em?.events?.total),
    ytd: num(em?.events?.ytd),
    quarter: num(em?.events?.quarter),
  };
  const meetups = {
    total: num(em?.meetups?.total),
    ytd: num(em?.meetups?.ytd),
    quarter: num(em?.meetups?.quarter),
  };

  return {
    events,
    meetups,
    eventsChapterRows: em?.eventsChapterRows ?? [],
    meetupsChapterRows: em?.meetupsChapterRows ?? [],
    quarterLabel,
    // Legacy fields for management dashboard compatibility
    meetupsTotal: meetups.total,
    meetupsYtd: meetups.ytd,
    chapterEventsTotal: events.total,
    chapterEventsYtd: events.ytd,
  };
}

export type EngagementActivityRow = {
  activity: string;
  quarter: number;
  ytd: number;
};

export function mapEngagementActivities(data: ManagementDashboardPayload | undefined) {
  const chart = engagementActivitiesChart(data);
  const a = data?.sectionB?.activities;
  const quarterLabel = resolveQuarterLabel(data);
  const rows: EngagementActivityRow[] = [
    { activity: "Mentorship", quarter: num(a?.mentorshipSessions?.quarter), ytd: num(a?.mentorshipSessions?.ytd) },
    { activity: "Seminars", quarter: num(a?.seminarsParticipation?.quarter), ytd: num(a?.seminarsParticipation?.ytd) },
    { activity: "Conferences", quarter: num(a?.conferencesParticipation?.quarter), ytd: num(a?.conferencesParticipation?.ytd) },
    { activity: "Alumni Talks", quarter: num(a?.alumniTalks?.quarter), ytd: num(a?.alumniTalks?.ytd) },
    { activity: "High Achievers", quarter: num(a?.highAchieversRecognition?.quarter), ytd: num(a?.highAchieversRecognition?.ytd) },
    { activity: "Wellbeing", quarter: num(a?.wellbeingSupport?.quarter), ytd: num(a?.wellbeingSupport?.ytd) },
  ];
  const quarterTotal = rows.reduce((sum, row) => sum + row.quarter, 0);
  const ytdTotal = rows.reduce((sum, row) => sum + row.ytd, 0);
  const ranked = [...rows].sort((x, y) => y.ytd - x.ytd || y.quarter - x.quarter);
  const topByYtd = ranked[0] ?? { activity: "—", quarter: 0, ytd: 0 };
  const topByQuarter = [...rows].sort((x, y) => y.quarter - x.quarter)[0] ?? topByYtd;
  const activeTypes = rows.filter((row) => row.ytd > 0 || row.quarter > 0).length;

  return {
    chartSeries: chart.chartSeries,
    rows,
    quarterTotal,
    ytdTotal,
    quarterLabel,
    topByYtd,
    topByQuarter,
    activeTypes,
    topRows: ranked.slice(0, 3),
  };
}

export function mapPublicationsSurveys(data: ManagementDashboardPayload | undefined) {
  const chart = publicationsChart(data);
  const p = data?.sectionB?.publications;
  const { primary, secondary } = getPeriodColumnLabels(data);
  return {
    chartSeries: chart.chartSeries,
    chartSeriesSecondary: chart.chartSeriesSecondary,
    surveys: num(p?.surveysConducted),
    stories: num(p?.successStoriesPublished),
    storiesQuarter: num(p?.successStoriesQuarter),
    storiesYtd: num(p?.successStoriesYtd),
    newsletters: num(p?.newslettersIssued),
    newslettersQuarter: num(p?.newslettersQuarter),
    newslettersYtd: num(p?.newslettersYtd),
    quarterLabel: resolveQuarterLabel(data),
    periodPrimary: primary,
    periodSecondary: secondary,
    facultyRows: p?.facultyPublicationRows ?? [],
  };
}

export function mapMembershipsPerks(data: ManagementDashboardPayload | undefined) {
  const chart = membershipsChart(data);
  const m = data?.sectionD?.memberships;
  const gymApplied = num(m?.gymDiscountActive);
  const gymApproved = num(m?.gymApproved);
  const poolApplied = num(m?.swimmingPoolDiscountActive);
  const poolApproved = num(m?.swimmingPoolApproved);
  const qalanderApplied = num(m?.qalanderClub);
  const qalanderApproved = num(m?.qalanderApproved);
  const totalApplied = num(m?.totalMemberships);
  const totalApproved = num(m?.totalApproved);
  return {
    total: totalApplied,
    totalApproved,
    gym: gymApproved,
    pool: poolApproved,
    qalander: qalanderApproved,
    gymApplied,
    gymApproved,
    poolApplied,
    poolApproved,
    qalanderApplied,
    qalanderApproved,
    facultyRows: data?.sectionD?.facultyMembershipRows ?? [],
    chartSeries: chart.chartSeries,
    memberships: m,
  };
}

export function mapDiscountsMerchants(data: ManagementDashboardPayload | undefined) {
  const discounts = discountCategoriesChart(data);
  const merchantsChart = merchantPartnershipsChart(data);
  const dc = data?.sectionD?.discountCategories;
  const dining = num(dc?.diningAndCafes);
  const retail = num(dc?.retailAndShopping);
  const travel = num(dc?.travelAndLeisure);
  const health = num(dc?.healthAndWellness);
  const professional = num(dc?.professionalServices);
  const financial = num(dc?.financialServices);
  const total = num(dc?.totalApplications);
  const merchantList = data?.sectionD?.merchants ?? [];
  const categories = [
    { key: "dining", label: "Dining", value: dining },
    { key: "retail", label: "Retail", value: retail },
    { key: "travel", label: "Travel", value: travel },
    { key: "health", label: "Health", value: health },
    { key: "professional", label: "Professional", value: professional },
    { key: "financial", label: "Financial", value: financial },
  ];
  const topCategory = [...categories].sort((a, b) => b.value - a.value)[0] ?? {
    label: "—",
    value: 0,
  };

  return {
    total,
    dining,
    retail,
    travel,
    health,
    professional,
    financial,
    merchantCount: merchantList.length,
    categories,
    topCategory,
    facultyRows: data?.sectionD?.facultyDiscountRows ?? [],
    discountSeries: discounts.chartSeries,
    merchantSeries: merchantsChart.chartSeries,
    merchants: merchantList,
  };
}

export function mapTrainedAdmins(data: ManagementDashboardPayload | undefined) {
  const trained = data?.sectionA?.trainedFacultyAdmins;
  const chart = trainedAdminChart(trained);
  const byFaculty = (trained?.byFaculty ?? []).map((row) => ({
    ...row,
    faculty: row.faculty,
    facultyShort: stripFacultyOfPrefix(row.faculty),
  }));
  return {
    total: num(trained?.total),
    superadminsTotal: num(trained?.superadminsTotal),
    adminsTotal: num(trained?.adminsTotal),
    viewersTotal: num(trained?.viewersTotal),
    byFaculty,
    chartSeries: chart.chartSeries,
  };
}
