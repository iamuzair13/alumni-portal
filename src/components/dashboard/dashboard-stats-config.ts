import type { LucideIcon } from "lucide-react";
import { Users, BadgeCheck, Clock3, Activity, Award } from "lucide-react";
import type { AlumniTrendPoint } from "@/services/dashboardService";

export type DashboardTabKey =
  | "total"
  | "verified"
  | "underApproval"
  | "active"
  | "aPlus"
  | "a"
  | "b"
  | "c"
  | "d"
  | "distinguished";

export type StatSemanticColor = "blue" | "emerald" | "amber" | "indigo" | "rose";

export type PrimaryMetricConfig = {
  key: DashboardTabKey;
  label: string;
  icon: LucideIcon;
  color: StatSemanticColor;
  sparklineKey?: keyof AlumniTrendPoint;
  badge?: { label: string; variant?: "default" | "status" };
};

export type CategorySegmentConfig = {
  key: DashboardTabKey;
  label: string;
  tooltip?: string;
};

export const PRIMARY_METRICS: PrimaryMetricConfig[] = [
  {
    key: "total",
    label: "Total Alumni",
    icon: Users,
    color: "blue",
    sparklineKey: "total",
    badge: { label: "All records", variant: "status" },
  },
  {
    key: "verified",
    label: "Verified Alumni",
    icon: BadgeCheck,
    color: "emerald",
    sparklineKey: "verified",
    badge: { label: "Verified", variant: "status" },
  },
  {
    key: "underApproval",
    label: "Under Approval",
    icon: Clock3,
    color: "amber",
    badge: { label: "Pending", variant: "status" },
  },
  {
    key: "active",
    label: "Active Alumni",
    icon: Activity,
    color: "indigo",
    sparklineKey: "active",
    badge: { label: "Active", variant: "status" },
  },
  {
    key: "distinguished",
    label: "Distinguished Alumni",
    icon: Award,
    color: "rose",
    sparklineKey: "distinguished",
    badge: { label: "Featured", variant: "status" },
  },
];

export const CATEGORY_SEGMENTS: CategorySegmentConfig[] = [
  { key: "aPlus", label: "A+", tooltip: "A+ is always assigned manually." },
  { key: "a", label: "A", tooltip: "Pass-out more than 7 years ago." },
  { key: "b", label: "B", tooltip: "Pass-out 4 to <7 years ago, OR Pursuing Higher Education with PhD." },
  { key: "c", label: "C", tooltip: "Pass-out 2 to <4 years ago, OR Pursuing Higher Education with Masters." },
  { key: "d", label: "D", tooltip: "Pass-out less than 2 years ago." },
];

export const STAT_COLOR_THEMES: Record<
  StatSemanticColor,
  {
    cardBg: string;
    cardBgSelected: string;
    icon: string;
    ring: string;
    spark: string;
    badge: string;
  }
> = {
  blue: {
    cardBg: "bg-blue-50/80 dark:bg-blue-950/30",
    cardBgSelected: "bg-blue-50 dark:bg-blue-950/40",
    icon: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/40",
    spark: "#3b82f6",
    badge: "bg-blue-100/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  emerald: {
    cardBg: "bg-emerald-50/80 dark:bg-emerald-950/30",
    cardBgSelected: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/40",
    spark: "#10b981",
    badge: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  amber: {
    cardBg: "bg-amber-50/80 dark:bg-amber-950/30",
    cardBgSelected: "bg-amber-50 dark:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/40",
    spark: "#f59e0b",
    badge: "bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  indigo: {
    cardBg: "bg-indigo-50/80 dark:bg-indigo-950/30",
    cardBgSelected: "bg-indigo-50 dark:bg-indigo-950/40",
    icon: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/40",
    spark: "#6366f1",
    badge: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  rose: {
    cardBg: "bg-rose-50/80 dark:bg-rose-950/30",
    cardBgSelected: "bg-rose-50 dark:bg-rose-950/40",
    icon: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/40",
    spark: "#f43f5e",
    badge: "bg-rose-100/80 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
};

export const CATEGORY_SEGMENT_COLORS: Record<
  DashboardTabKey,
  { active: string; text: string }
> = {
  aPlus: {
    active: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-400",
  },
  a: { active: "bg-blue-500/15 text-blue-700 dark:text-blue-300", text: "text-blue-600 dark:text-blue-400" },
  b: { active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", text: "text-emerald-600 dark:text-emerald-400" },
  c: { active: "bg-amber-500/15 text-amber-700 dark:text-amber-300", text: "text-amber-600 dark:text-amber-400" },
  d: { active: "bg-slate-500/15 text-slate-700 dark:text-slate-300", text: "text-slate-600 dark:text-slate-400" },
  total: { active: "", text: "" },
  verified: { active: "", text: "" },
  underApproval: { active: "", text: "" },
  active: { active: "", text: "" },
  distinguished: { active: "", text: "" },
};

export function buildSparklineSeries(
  points: AlumniTrendPoint[],
  key: keyof AlumniTrendPoint,
  maxPoints = 8
): number[] {
  const slice = points.slice(-maxPoints);
  return slice.map((p) => Number(p[key] ?? 0));
}

export function computeTrendDelta(series: number[]): { value: string; positive: boolean } | undefined {
  if (series.length < 2) return undefined;
  const prev = series[series.length - 2];
  const curr = series[series.length - 1];
  if (prev === 0 && curr === 0) return undefined;
  if (prev === 0) return { value: "+100%", positive: true };
  const pct = ((curr - prev) / prev) * 100;
  const rounded = Math.abs(Math.round(pct));
  if (rounded === 0) return undefined;
  return {
    value: `${pct >= 0 ? "+" : "-"}${rounded}%`,
    positive: pct >= 0,
  };
}
