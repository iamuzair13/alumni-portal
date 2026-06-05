import type { AlumniTrendPoint } from "@/services/dashboardService";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

export type RegistrationTrendChartPoint = {
  period: string;
  label: string;
  total: number;
  verified: number;
  active: number;
};

function formatDailyLabel(period: string): string {
  const d = new Date(`${period}T12:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatMonthlyLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return d.toLocaleDateString("en", { month: "short", year: "2-digit" });
}

function sortTrends(trends: AlumniTrendPoint[]): AlumniTrendPoint[] {
  return [...trends].sort((a, b) => a.period.localeCompare(b.period));
}

/** Build bar chart series through the latest available bucket (daily or monthly). */
export function buildRegistrationTrendChartSeries(
  dailyTrends: AlumniTrendPoint[] | undefined,
  monthlyTrends: AlumniTrendPoint[] | undefined,
  meta: ManagementDashboardPayload["meta"] | undefined,
  dailyWindow = 14
): { points: RegistrationTrendChartPoint[]; asOfLabel: string | null; granularity: "daily" | "monthly" } {
  const periodType = meta?.periodType ?? "all";

  if (periodType === "year" && meta?.year) {
    const yearPrefix = String(meta.year);
    const filtered = sortTrends(monthlyTrends ?? []).filter((p) => p.period.startsWith(yearPrefix));
    const points = filtered.map((p) => ({
      period: p.period,
      label: formatMonthlyLabel(p.period),
      total: p.total,
      verified: p.verified,
      active: p.active,
    }));
    const latest = points[points.length - 1];
    return { points, asOfLabel: latest ? latest.label : null, granularity: "monthly" };
  }

  if (periodType === "month" && meta?.year && meta?.month) {
    const prefix = `${meta.year}-${String(meta.month).padStart(2, "0")}`;
    const filtered = sortTrends(dailyTrends ?? []).filter((p) => p.period.startsWith(prefix));
    const points = filtered.map((p) => ({
      period: p.period,
      label: formatDailyLabel(p.period),
      total: p.total,
      verified: p.verified,
      active: p.active,
    }));
    const latest = points[points.length - 1];
    return { points, asOfLabel: latest ? latest.label : null, granularity: "daily" };
  }

  const sortedDaily = sortTrends(dailyTrends ?? []);
  const filteredDaily = sortedDaily.slice(-dailyWindow);
  if (filteredDaily.length >= 2) {
    const points = filteredDaily.map((p) => ({
      period: p.period,
      label: formatDailyLabel(p.period),
      total: p.total,
      verified: p.verified,
      active: p.active,
    }));
    const latest = points[points.length - 1];
    return { points, asOfLabel: latest ? latest.label : null, granularity: "daily" };
  }

  const filteredMonthly = sortTrends(monthlyTrends ?? []).slice(-12);
  const points = filteredMonthly.map((p) => ({
    period: p.period,
    label: formatMonthlyLabel(p.period),
    total: p.total,
    verified: p.verified,
    active: p.active,
  }));
  const latest = points[points.length - 1];
  return { points, asOfLabel: latest ? latest.label : null, granularity: "monthly" };
}
