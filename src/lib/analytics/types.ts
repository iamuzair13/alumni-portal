export type AnalyticsPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type AnalyticsModule =
  | "dashboard"
  | "alumni_cards"
  | "alumni_talks"
  | "alumni_chapters"
  | "alumni_association"
  | "scholarships"
  | "memberships"
  | "leadership"
  | "jobs";

export type AnalyticsSeries = {
  labels: string[];
  data: number[];
  total: number;
  growth: number;
};

export type DashboardAnalytics = AnalyticsSeries & {
  moduleTotals: Array<{ module: Exclude<AnalyticsModule, "dashboard">; total: number; growth: number }>;
};

