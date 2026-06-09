import type { KpiConfigItem } from "../utils/kpiConfig";

export const KPI_COLOR_HEX: Record<KpiConfigItem["color"], string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  orange: "#f97316",
  slate: "#64748b",
  blue: "#3b82f6",
};

export const CHART_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#f97316",
  "#64748b",
  "#3b82f6",
];

export function colorAt(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
