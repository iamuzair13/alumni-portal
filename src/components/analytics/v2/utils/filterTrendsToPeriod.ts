import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

/** Filter monthly alumni trend points to the dashboard's selected year/month. Returns all when period is "all". */
export function filterTrendsToPeriod(
  trends: AlumniTrendPoint[] | undefined,
  meta: ManagementDashboardPayload["meta"] | undefined
): AlumniTrendPoint[] {
  if (!trends?.length) return [];
  if (!meta || meta.periodType === "all" || !meta.periodType) return trends.slice(-12);
  if (!meta.year) return trends.slice(-12);

  const yearPrefix = String(meta.year);

  if (meta.periodType === "month" && meta.month) {
    const monthKey = `${yearPrefix}-${String(meta.month).padStart(2, "0")}`;
    const filtered = trends.filter((p) => p.period === monthKey || p.period.startsWith(monthKey));
    return filtered.length > 0 ? filtered : trends.slice(-12);
  }

  const filtered = trends.filter((p) => p.period.startsWith(yearPrefix));
  return filtered.length > 0 ? filtered : trends.slice(-12);
}
