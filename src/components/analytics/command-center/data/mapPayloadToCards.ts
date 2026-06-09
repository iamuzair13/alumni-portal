import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { ChartSeriesPoint } from "@/components/analytics/v2/utils/kpiConfig";
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
  transitionVelocityScore,
  trainedAdminChart,
} from "@/components/analytics/v2/utils/chartSeriesBuilders";

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

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
  return {
    primaryValue: total,
    secondaryLabel: `${active.toLocaleString()} active · ${verified.toLocaleString()} verified`,
    chartSeries: chart.chartSeries,
    insight: chart.insight,
    facultyRows: data?.sectionA?.facultyRows ?? [],
  };
}

export function mapAlumniCategories(data: ManagementDashboardPayload | undefined) {
  const chart = alumniCategoriesChart(data);
  const cat = data?.alumniHeadline?.category;
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

export function mapAlumniOccupation(data: ManagementDashboardPayload | undefined) {
  const chart = occupationChart(data);
  const oc = data?.sectionA?.currentOccupation;
  return {
    chartSeries: chart.chartSeries,
    rows: [
      { status: "Employed", count: num(oc?.employed) },
      { status: "Self-employed", count: num(oc?.selfEmployed) },
      { status: "Unemployed (searching)", count: num(oc?.unemployedSearching) },
      { status: "Unemployed (by choice)", count: num(oc?.unemployedByChoice) },
      { status: "Other", count: num(oc?.other) },
    ],
  };
}

export function mapHonorCards(data: ManagementDashboardPayload | undefined) {
  const chart = honorCardsChart(data);
  const cards = data?.sectionB?.cardsStatus;
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

export function mapTransitionVelocity(data: ManagementDashboardPayload | undefined) {
  const tv = data?.sectionA?.transitionVelocity;
  const totalAlumni = num(data?.alumniHeadline?.total ?? data?.kpis?.totalAlumni);
  const chart = transitionVelocityChart(tv, totalAlumni);
  const score = transitionVelocityScore(tv, totalAlumni);
  return { score, chartSeries: chart.chartSeries, insight: chart.insight, totalAlumni };
}

export function mapLocation(data: ManagementDashboardPayload | undefined) {
  const chart = provinceLocationChart(data);
  const pl = data?.sectionA?.provinceLocation;
  return {
    chartSeries: chart.chartSeries,
    rows: [
      { region: "Punjab", count: num(pl?.punjab) },
      { region: "Islamabad", count: num(pl?.islamabad) },
      { region: "KPK", count: num(pl?.kpk) },
      { region: "Sindh", count: num(pl?.sindh) },
      { region: "AJK", count: num(pl?.ajk) },
      { region: "GB", count: num(pl?.gb) },
      { region: "Balochistan", count: num(pl?.balochistan) },
      { region: "Overseas", count: num(pl?.overseas) },
      { region: "Other", count: num(pl?.other) },
    ],
  };
}

export function mapEngagementsChapters(data: ManagementDashboardPayload | undefined) {
  const ch = data?.sectionB?.chaptersAssociations;
  const chart = chaptersAssociationsChart(data);
  return {
    national: num(ch?.nationalChapters),
    international: num(ch?.internationalChapters),
    members: num(ch?.members),
    meetupsYtd: num(ch?.meetupsYtd),
    chartSeries: chart.chartSeries,
  };
}

export function mapCareerBenefits(data: ManagementDashboardPayload | undefined) {
  const oc = data?.sectionA?.currentOccupation;
  const employed = num(oc?.employed) + num(oc?.selfEmployed);
  const denom = employed + num(oc?.unemployedSearching) + num(oc?.unemployedByChoice) + num(oc?.other);
  const chart = careerBenefitsChart(employed, denom, data);
  const career = careerServicesChart(data);
  const scholarships = scholarshipsChart(data);
  return { chart, career, scholarships, kpis: data?.kpis };
}

export function mapMeetupsEvents(data: ManagementDashboardPayload | undefined) {
  const ch = data?.sectionB?.chaptersAssociations;
  const events = data?.sectionB?.activities?.chapterEvents;
  return {
    meetupsTotal: num(ch?.meetupsTotal),
    meetupsYtd: num(ch?.meetupsYtd),
    chapterEventsTotal: num(events?.total),
    chapterEventsYtd: num(events?.ytd),
    heatmapSeries: buildMeetupHeatmap(ch),
  };
}

function buildMeetupHeatmap(ch: ManagementDashboardPayload["sectionB"]["chaptersAssociations"] | undefined): ChartSeriesPoint[] {
  return [
    { label: "Q", value: num(ch?.meetupsQuarter) },
    { label: "YTD", value: num(ch?.meetupsYtd) },
    { label: "Total", value: num(ch?.meetupsTotal) },
  ];
}

export function mapEngagementActivities(data: ManagementDashboardPayload | undefined) {
  const chart = engagementActivitiesChart(data);
  const a = data?.sectionB?.activities;
  return {
    chartSeries: chart.chartSeries,
    rows: [
      { activity: "Mentorship", quarter: num(a?.mentorshipSessions?.quarter), ytd: num(a?.mentorshipSessions?.ytd) },
      { activity: "Seminars", quarter: num(a?.seminarsParticipation?.quarter), ytd: num(a?.seminarsParticipation?.ytd) },
      { activity: "Conferences", quarter: num(a?.conferencesParticipation?.quarter), ytd: num(a?.conferencesParticipation?.ytd) },
      { activity: "Alumni Talks", quarter: num(a?.alumniTalks?.quarter), ytd: num(a?.alumniTalks?.ytd) },
      { activity: "High Achievers", quarter: num(a?.highAchieversRecognition?.quarter), ytd: num(a?.highAchieversRecognition?.ytd) },
      { activity: "Wellbeing", quarter: num(a?.wellbeingSupport?.quarter), ytd: num(a?.wellbeingSupport?.ytd) },
    ],
  };
}

export function mapPublicationsSurveys(data: ManagementDashboardPayload | undefined) {
  const chart = publicationsChart(data);
  const p = data?.sectionB?.publications;
  return {
    chartSeries: chart.chartSeries,
    chartSeriesSecondary: chart.chartSeriesSecondary,
    surveys: num(p?.surveysConducted),
    stories: num(p?.successStoriesPublished),
    newsletters: num(p?.newslettersIssued),
  };
}

export function mapMembershipsPerks(data: ManagementDashboardPayload | undefined) {
  const chart = membershipsChart(data);
  return { chartSeries: chart.chartSeries, memberships: data?.sectionD?.memberships };
}

export function mapDiscountsMerchants(data: ManagementDashboardPayload | undefined) {
  const discounts = discountCategoriesChart(data);
  const merchants = merchantPartnershipsChart(data);
  return {
    discountSeries: discounts.chartSeries,
    merchantSeries: merchants.chartSeries,
    merchants: data?.sectionD?.merchants ?? [],
  };
}

export function mapTrainedAdmins(data: ManagementDashboardPayload | undefined) {
  const trained = data?.sectionA?.trainedFacultyAdmins;
  const chart = trainedAdminChart(trained);
  return {
    total: num(trained?.total),
    byFaculty: trained?.byFaculty ?? [],
    chartSeries: chart.chartSeries,
  };
}
