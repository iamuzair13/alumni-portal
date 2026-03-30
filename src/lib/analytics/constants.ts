import type { AnalyticsPeriod } from "./types";

export const PERIODS: ReadonlyArray<AnalyticsPeriod> = ["daily", "weekly", "monthly", "yearly"] as const;

export const PERIOD_WINDOW_BUCKETS: Record<AnalyticsPeriod, number> = {
  daily: 30,
  weekly: 12,
  monthly: 12,
  yearly: 5,
};

export const PERIOD_DATE_TRUNC: Record<AnalyticsPeriod, "day" | "week" | "month" | "year"> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

export const PERIOD_STEP_INTERVAL: Record<AnalyticsPeriod, "1 day" | "1 week" | "1 month" | "1 year"> = {
  daily: "1 day",
  weekly: "1 week",
  monthly: "1 month",
  yearly: "1 year",
};

