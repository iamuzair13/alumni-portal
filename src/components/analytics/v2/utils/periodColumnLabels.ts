import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

export function getPeriodColumnLabels(data: ManagementDashboardPayload | undefined) {
  const meta = data?.meta;
  const isAll = !meta?.periodType || meta.periodType === "all";

  return {
    primary: isAll ? "This Quarter" : (meta?.periodColumnPrimary ?? meta?.timeRange ?? "Selected period"),
    secondary: isAll ? "YTD" : (meta?.periodColumnSecondary ?? "YTD"),
    periodLabel: meta?.timeRange ?? "All time",
  };
}
