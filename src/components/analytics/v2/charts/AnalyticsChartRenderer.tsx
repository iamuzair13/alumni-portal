"use client";

import React from "react";
import type { KpiConfigGroup } from "../utils/kpiConfig";
import { ChartFooterSummary } from "@/components/ui/chart";
import {
  BarChartWidget,
  DonutChart,
  FunnelChartWidget,
  GroupedBarChartWidget,
  HeatmapChartWidget,
  RadarChartWidget,
  StackedBarChartWidget,
  TreemapChartWidget,
} from "./ChartWidgets";
import { PakistanProvinceMap } from "./PakistanProvinceMap";
import { CHART_HEIGHT_COMPACT, CHART_HEIGHT_FULL } from "../layout/analyticsTheme";

function chartSummary(group: KpiConfigGroup) {
  const series = (group.chartSeries ?? []).filter((d) => d.value > 0);
  if (!series.length) return null;
  const top = [...series].sort((a, b) => b.value - a.value)[0];
  const total = series.reduce((sum, d) => sum + d.value, 0);
  return { top, total };
}

export function AnalyticsChartRenderer({
  group,
  compact,
  navPreview,
  showLabels: showLabelsProp,
}: {
  group: KpiConfigGroup;
  compact?: boolean;
  navPreview?: boolean;
  showLabels?: boolean;
}) {
  const { chartType, chartSeries = [], chartSeriesSecondary, chartMeta } = group;
  const primaryLabel = chartMeta?.primaryLabel ?? "Primary";
  const secondaryLabel = chartMeta?.secondaryLabel ?? "Secondary";
  const showLabels = navPreview ? false : (showLabelsProp ?? true);
  const summary = !compact && !navPreview ? chartSummary(group) : null;
  const chartProps = { compact, navPreview, showLabels };

  const footer =
    summary && !compact ? (
      <ChartFooterSummary
        topLabel={summary.top.label}
        topValue={summary.top.value}
        totalLabel="Total"
        totalValue={summary.total}
      />
    ) : null;

  const wrap = (chart: React.ReactNode) => (
    <div>
      {chart}
      {footer}
    </div>
  );

  const labelFormatter = (value: number, index: number) => {
    const point = chartSeries[index];
    const formatted = point?.meta?.formatted;
    if (typeof formatted === "string") return formatted;
    return undefined;
  };

  switch (chartType) {
    case "donut":
      return wrap(<DonutChart data={chartSeries} {...chartProps} />);
    case "bar":
      return wrap(
        <BarChartWidget
          data={chartSeries}
          {...chartProps}
          horizontal
          labelFormatter={labelFormatter}
        />
      );
    case "treemap":
      return wrap(<TreemapChartWidget data={chartSeries} {...chartProps} />);
    case "geo":
      return wrap(
        <div style={{ height: navPreview ? 72 : compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT_FULL }}>
          <PakistanProvinceMap data={chartSeries} compact={compact || navPreview} />
        </div>
      );
    case "funnel":
      return wrap(<FunnelChartWidget data={chartSeries} {...chartProps} />);
    case "stacked-bar":
      return wrap(
        <StackedBarChartWidget
          primary={chartSeries}
          secondary={chartSeriesSecondary}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          {...chartProps}
        />
      );
    case "grouped-bar":
      return wrap(
        <GroupedBarChartWidget
          primary={chartSeries}
          secondary={chartSeriesSecondary}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          {...chartProps}
        />
      );
    case "radar":
      return wrap(<RadarChartWidget data={chartSeries} {...chartProps} />);
    case "heatmap":
      return wrap(
        <HeatmapChartWidget
          data={chartSeries}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          {...chartProps}
        />
      );
    default:
      return wrap(
        <BarChartWidget
          data={chartSeries}
          {...chartProps}
          labelFormatter={labelFormatter}
        />
      );
  }
}
