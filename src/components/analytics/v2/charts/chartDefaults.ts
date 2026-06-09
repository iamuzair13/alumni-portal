import type { CSSProperties } from "react";
import {
  CHART_HEIGHT_COMPACT,
  CHART_HEIGHT_FULL,
  CHART_HEIGHT_HERO,
  CHART_HEIGHT_MAP_COMPACT,
  CHART_HEIGHT_MAP_FULL,
  CHART_HEIGHT_NAV,
} from "../layout/analyticsTheme";

export const CHART_TICK = { fontSize: 12, fill: "currentColor" } as const;
export const CHART_TICK_COMPACT = { fontSize: 11, fill: "currentColor" } as const;

export const CHART_LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
};

export const CHART_LABEL_STYLE_COMPACT: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
};

export const CHART_LEGEND_STYLE = { fontSize: 12, paddingTop: 8 } as const;
export const CHART_LEGEND_ICON = 10;

export function chartHeight(compact?: boolean, map?: boolean, hero?: boolean, navPreview?: boolean): number {
  if (hero) return CHART_HEIGHT_HERO;
  if (map) return compact ? CHART_HEIGHT_MAP_COMPACT : CHART_HEIGHT_MAP_FULL;
  if (navPreview) return CHART_HEIGHT_NAV;
  return compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT_FULL;
}

export function formatChartLabel(value: number): string {
  if (value <= 0) return "";
  return value.toLocaleString();
}

export function shouldShowBarLabel(value: number, compact?: boolean): boolean {
  if (value <= 0) return false;
  if (compact && value < 1) return false;
  return true;
}

export function truncateAxisLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

export function tickProps(compact?: boolean) {
  return compact ? CHART_TICK_COMPACT : CHART_TICK;
}

export function labelStyle(compact?: boolean): CSSProperties {
  return compact ? CHART_LABEL_STYLE_COMPACT : CHART_LABEL_STYLE;
}

export const BAR_CHART_MARGIN = { top: 20, right: 12, left: 8, bottom: 4 };
export const BAR_CHART_MARGIN_COMPACT = { top: 16, right: 8, left: 4, bottom: 0 };
export const HORIZONTAL_BAR_MARGIN = { top: 8, right: 52, left: 8, bottom: 4 };
export const HORIZONTAL_BAR_MARGIN_COMPACT = { top: 4, right: 36, left: 2, bottom: 0 };
export const HORIZONTAL_BAR_MARGIN_NAV = { top: 2, right: 28, left: 0, bottom: 0 };
