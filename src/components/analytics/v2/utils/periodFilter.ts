export type PeriodType = "all" | "year" | "month" | "range";

export type AnalyticsPeriodFilter = {
  periodType: PeriodType;
  year: number;
  month: number;
  /** ISO date (YYYY-MM-DD) — used when periodType is "range" */
  dateFrom: string;
  /** ISO date (YYYY-MM-DD) — used when periodType is "range" */
  dateTo: string;
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

export function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: toISODateString(from), dateTo: toISODateString(now) };
}

export function defaultPeriodFilter(): AnalyticsPeriodFilter {
  const now = new Date();
  const { dateFrom, dateTo } = defaultDateRange();
  return {
    periodType: "all",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    dateFrom,
    dateTo,
  };
}

export function buildYearOptions(count = 10): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => current - i);
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function normalizeDateRange(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  if (!dateFrom || !dateTo) return { dateFrom, dateTo };
  if (dateFrom <= dateTo) return { dateFrom, dateTo };
  return { dateFrom: dateTo, dateTo: dateFrom };
}

/** Whether a trend bucket (YYYY-MM-DD or YYYY-MM) overlaps an inclusive ISO date range. */
export function periodBucketOverlapsRange(period: string, rangeStart: string, rangeEnd: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return period >= rangeStart && period <= rangeEnd;
  }
  const monthly = /^(\d{4})-(\d{2})$/.exec(period);
  if (monthly) {
    const monthStart = `${monthly[1]}-${monthly[2]}-01`;
    const lastDay = new Date(Number(monthly[1]), Number(monthly[2]), 0).getDate();
    const monthEnd = `${monthly[1]}-${monthly[2]}-${String(lastDay).padStart(2, "0")}`;
    return monthStart <= rangeEnd && monthEnd >= rangeStart;
  }
  return period >= rangeStart && period <= rangeEnd;
}

export function formatPeriodLabel(filter: AnalyticsPeriodFilter): string {
  if (filter.periodType === "all") return "All time";
  if (filter.periodType === "range") {
    const { dateFrom, dateTo } = normalizeDateRange(filter.dateFrom, filter.dateTo);
    if (dateFrom && dateTo) return `${formatShortDate(dateFrom)} – ${formatShortDate(dateTo)}`;
    return "Custom range";
  }
  if (filter.periodType === "month") {
    const name = MONTH_OPTIONS.find((m) => m.value === filter.month)?.label ?? "Month";
    return `${name} ${filter.year}`;
  }
  return String(filter.year);
}

export function isPeriodFilterActive(filter: AnalyticsPeriodFilter): boolean {
  return filter.periodType === "year" || filter.periodType === "month" || filter.periodType === "range";
}

export function periodFilterToSearchParams(filter: AnalyticsPeriodFilter): URLSearchParams {
  const params = new URLSearchParams();
  params.set("periodType", filter.periodType);
  params.set("year", String(filter.year));
  if (filter.periodType === "month") {
    params.set("month", String(filter.month));
  }
  if (filter.periodType === "range") {
    const { dateFrom, dateTo } = normalizeDateRange(filter.dateFrom, filter.dateTo);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
  }
  return params;
}
