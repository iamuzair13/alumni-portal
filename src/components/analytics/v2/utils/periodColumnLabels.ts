import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

export function formatQuarterMonthLabel(quarterStart: string): string {
  const start = new Date(`${quarterStart}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "Last 3 Months";
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleString("en", { month: "short" });
  return `${fmt(start)}–${fmt(now)} ${now.getFullYear()}`;
}

export function resolveQuarterLabel(data: ManagementDashboardPayload | undefined): string {
  const meta = data?.meta;
  if (meta?.periodType && meta.periodType !== "all") {
    return meta.periodColumnPrimary ?? "This period";
  }
  return meta?.quarterMonthLabel ?? formatQuarterMonthLabel(meta?.quarterStart ?? "");
}

export function getPeriodColumnLabels(data: ManagementDashboardPayload | undefined) {
  const meta = data?.meta;
  const isAll = !meta?.periodType || meta.periodType === "all";

  return {
    primary: isAll ? "Last 3 Months" : (meta?.periodColumnPrimary ?? meta?.timeRange ?? "Selected period"),
    secondary: isAll ? "YTD" : (meta?.periodColumnSecondary ?? "YTD"),
    periodLabel: meta?.timeRange ?? "All time",
  };
}
