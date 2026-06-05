/**
 * Management dashboard (admin analytics) payload shape — aligned with Excel spec sections A–D.
 * Populated by GET /api/analytics/realtime-dashboard
 */

export type QuarterYtd = { quarter: number | null; ytd: number | null };

export type ManagementDashboardAlumniHeadline = {
  total: number | null;
  verified: number | null;
  category: {
    aPlus: number | null;
    a: number | null;
    b: number | null;
    c: number | null;
    d: number | null;
  };
};

/** Portal staff with faculty scope: `user_access_assignments` × `users` (admin/viewer, not blocked). Labeled “trained” per management dashboard spec. */
export type TrainedFacultyAdminsPayload = {
  total: number | null;
  byFaculty: Array<{ faculty: string; facultyId: number | null; count: number }>;
};

export type ManagementDashboardSectionA = {
  facultyRows: Array<{ faculty: string; registrations: number }>;
  trainedFacultyAdmins: TrainedFacultyAdminsPayload;
  transitionVelocity: {
    beforeGraduation: number | null;
    immediateAfterGraduation: number | null;
    within3Months: number | null;
    within6Months: number | null;
    after6Months: number | null;
    unknown: number | null;
  };
  currentOccupation: {
    employed: number | null;
    selfEmployed: number | null;
    unemployedSearching: number | null;
    unemployedByChoice: number | null;
    other: number | null;
  };
  provinceLocation: {
    punjab: number | null;
    islamabad: number | null;
    kpk: number | null;
    sindh: number | null;
    ajk: number | null;
    gb: number | null;
    balochistan: number | null;
    overseas: number | null;
    other: number | null;
  };
};

export type ManagementDashboardCardsStatus = {
  totalCards: number | null;
  applied: number | null;
  review: number | null;
  onHold: number | null;
  underPrinting: number | null;
  readyForDelivery: number | null;
  delivered: number | null;
};

export type ManagementDashboardSectionB = {
  chaptersAssociations: {
    nationalChapters: number | null;
    internationalChapters: number | null;
    associations: number | null;
    members: number | null;
    leadersAppointed: number | null;
    meetupsQuarter: number | null;
    meetupsYtd: number | null;
    meetupsTotal: number | null;
  };
  cardsStatus: ManagementDashboardCardsStatus;
  activities: {
    mentorshipSessions: QuarterYtd;
    seminarsParticipation: QuarterYtd;
    conferencesParticipation: QuarterYtd;
    alumniTalks: QuarterYtd;
    highAchieversRecognition: QuarterYtd;
    wellbeingSupport: QuarterYtd;
    chapterEvents: { quarter: number | null; ytd: number | null; total: number | null };
  };
  publications: {
    successStoriesPublished: number | null;
    successStoriesQuarter: number | null;
    successStoriesYtd: number | null;
    newslettersIssued: number | null;
    newslettersQuarter: number | null;
    newslettersYtd: number | null;
    surveysConducted: number | null;
  };
};

export type ManagementDashboardSectionC = {
  career: {
    recruitmentDrives: QuarterYtd;
    jobsPostedUol: QuarterYtd;
    jobsPostedOtherEmployers: QuarterYtd;
    startupsSupport: QuarterYtd;
    upskillCourses: QuarterYtd;
  };
  scholarships: {
    kinship: { applied: number | null; processed: number | null };
    mastersPhd: { applied: number | null; processed: number | null };
    iqPrograms: { applied: number | null; processed: number | null };
  };
  giveBackFinancialAssistance: number | null;
};

export type ManagementDashboardSectionD = {
  memberships: {
    gymDiscountActive: number | null;
    swimmingPoolDiscountActive: number | null;
    freeGymThreeMonth: number | null;
    freePoolThreeMonth: number | null;
    qalanderClub: number | null;
    healthcareDiscounts: number | null;
    vehicleStickers: number | null;
  };
  discountCategories: {
    diningAndCafes: number | null;
    retailAndShopping: number | null;
    travelAndLeisure: number | null;
    healthAndWellness: number | null;
    professionalServices: number | null;
    financialServices: number | null;
  };
  merchants: Array<{ merchant: string; discount: string; reference: string }>;
};

/** Phase-1 seed when no merchants table exists (Excel sample + placeholders). */
export const MANAGEMENT_DASHBOARD_MERCHANT_SEED: Array<{ merchant: string; discount: string; reference: string }> = [
  { merchant: "Poet Restaurant", discount: "—", reference: "—" },
  { merchant: "Junmo Restaurant", discount: "15%", reference: "UOL Alumni Architecture 2021 Ibrar Malik" },
];

/**
 * Metrics that are not filtered by alumni faculty (org-wide event/job lists or global chapter definitions).
 */
export const MANAGEMENT_DASHBOARD_SCOPE_NOTES: readonly string[] = [
  "Chapter counts (national/international/associations) and approved leadership posts are organization-wide.",
  "Meetups and chapter events use tbl_events dates and are not filtered by alumni faculty.",
  "Job board recruitment/start-up/upskill heuristics scan all tbljobs rows.",
];

export type ManagementDashboardApiResponse = ManagementDashboardPayload & {
  scopeNotes: readonly string[];
  legacy?: {
    totalEventsMeetupsSelectedRange?: number | null;
    jobsUolAllTime?: number | null;
    jobsOtherAllTime?: number | null;
  };
};

export type ManagementDashboardPayload = {
  meta: {
    quarterStart: string;
    yearStart: string;
    timeRange: string;
  periodType?: "all" | "year" | "month";
  year?: number;
  month?: number | null;
  periodStart?: string;
  periodEnd?: string;
  periodColumnPrimary?: string;
  periodColumnSecondary?: string;
  facultyId: string | null;
  };
  alumniHeadline: ManagementDashboardAlumniHeadline;
  kpis: {
    totalAlumni: number | null;
    totalRegistrations: number | null;
    activeAlumni: number | null;
    totalEngagements: number | null;
    totalEventsMeetups: number | null;
    jobsPosted: number | null;
    scholarshipsProcessed: number | null;
    activeBenefitsDiscounts: number | null;
  };
  sectionA: ManagementDashboardSectionA;
  sectionB: ManagementDashboardSectionB;
  sectionC: ManagementDashboardSectionC;
  sectionD: ManagementDashboardSectionD;
};
