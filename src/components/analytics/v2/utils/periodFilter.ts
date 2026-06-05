export type PeriodType = "all" | "year" | "month";

export type AnalyticsPeriodFilter = {
  periodType: PeriodType;
  year: number;
  month: number;
};

export const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

export function defaultPeriodFilter(): AnalyticsPeriodFilter {
  const now = new Date();
  return {
    periodType: "all",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function buildYearOptions(count = 10): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => current - i);
}

export function formatPeriodLabel(filter: AnalyticsPeriodFilter): string {
  if (filter.periodType === "all") return "All time";
  if (filter.periodType === "month") {
    const name = MONTH_OPTIONS.find((m) => m.value === filter.month)?.label ?? "Month";
    return `${name} ${filter.year}`;
  }
  return String(filter.year);
}

export function isPeriodFilterActive(filter: AnalyticsPeriodFilter): boolean {
  return filter.periodType === "year" || filter.periodType === "month";
}

export function periodFilterToSearchParams(filter: AnalyticsPeriodFilter): URLSearchParams {
  const params = new URLSearchParams();
  params.set("periodType", filter.periodType);
  params.set("year", String(filter.year));
  if (filter.periodType === "month") {
    params.set("month", String(filter.month));
  }
  return params;
}
