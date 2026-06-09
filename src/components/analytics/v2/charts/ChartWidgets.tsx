"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipContent } from "@/components/ui/chart";
import type { ChartSeriesPoint } from "../utils/kpiConfig";
import {
  BAR_CHART_MARGIN,
  BAR_CHART_MARGIN_COMPACT,
  CHART_LEGEND_ICON,
  CHART_LEGEND_STYLE,
  HORIZONTAL_BAR_MARGIN,
  HORIZONTAL_BAR_MARGIN_COMPACT,
  HORIZONTAL_BAR_MARGIN_NAV,
  chartHeight,
  formatChartLabel,
  labelStyle,
  shouldShowBarLabel,
  tickProps,
  truncateAxisLabel,
} from "./chartDefaults";

type ChartWidgetProps = {
  compact?: boolean;
  navPreview?: boolean;
  showLabels?: boolean;
};
import { CHART_PALETTE, colorAt } from "./chartColors";

type ChartTooltipPayload = Parameters<typeof ChartTooltipContent>[0]["payload"];

function EmptyChart({ compact, navPreview }: ChartWidgetProps) {
  const h = chartHeight(compact, false, false, navPreview);
  return (
    <div
      className="flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
      style={{ height: h }}
    >
      No data for selected filters
    </div>
  );
}

function renderDonutLabel(compact?: boolean) {
  return ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    name,
    value,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    name?: string;
    value?: number;
    percent?: number;
  }) => {
    if (!value || value <= 0) return null;
    if (compact && (percent ?? 0) < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const label = name && name.length > 14 ? `${name.slice(0, 13)}…` : name;
    const percentSuffix = percent != null ? ` (${(percent * 100).toFixed(0)}%)` : "";
    return (
      <text
        x={x}
        y={y}
        fill="currentColor"
        className="fill-gray-700 dark:fill-gray-300"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {`${label}: ${value.toLocaleString()}${percentSuffix}`}
      </text>
    );
  };
}

export function DonutChart({
  data,
  compact,
  navPreview,
  showLabels = true,
}: ChartWidgetProps & { data: ChartSeriesPoint[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const useExternalLabels = showLabels && !compact && !navPreview;
  const pieData = filtered.map((d) => ({
    name: d.label,
    fullName: d.label,
    value: d.value,
    fill: d.color ?? colorAt(0),
  }));

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={navPreview ? 22 : compact ? 36 : 60}
            outerRadius={navPreview ? 32 : compact ? 52 : 88}
            paddingAngle={2}
            label={useExternalLabels ? renderDonutLabel(compact) : false}
            labelLine={useExternalLabels}
          >
            {pieData.map((entry, i) => (
              <Cell key={entry.name} fill={entry.fill ?? colorAt(i)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent active={active} payload={payload as ChartTooltipPayload} showPercent />
            )}
          />
          {!compact && !navPreview ? (
            <Legend wrapperStyle={CHART_LEGEND_STYLE} iconSize={CHART_LEGEND_ICON} />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChartWidget({
  data,
  compact,
  navPreview,
  horizontal = false,
  showLabels = true,
  labelFormatter,
}: ChartWidgetProps & {
  data: ChartSeriesPoint[];
  horizontal?: boolean;
  labelFormatter?: (value: number, index: number) => string | undefined;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const maxLen = navPreview ? 8 : compact ? 12 : 20;
  const chartData = filtered.map((d) => ({
    name: truncateAxisLabel(d.label, maxLen),
    fullName: d.label,
    value: d.value,
    fill: d.color ?? colorAt(0),
  }));

  const margin = horizontal
    ? navPreview
      ? HORIZONTAL_BAR_MARGIN_NAV
      : compact
        ? HORIZONTAL_BAR_MARGIN_COMPACT
        : HORIZONTAL_BAR_MARGIN
    : compact
      ? BAR_CHART_MARGIN_COMPACT
      : BAR_CHART_MARGIN;

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={margin}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-gray-800" />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={navPreview ? false : tickProps(compact)}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                hide={navPreview}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={navPreview ? false : tickProps(compact)}
                tickLine={false}
                axisLine={false}
                width={navPreview ? 0 : compact ? 76 : 120}
                hide={navPreview}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={tickProps(compact)}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={compact ? -20 : -15}
                textAnchor="end"
                height={compact ? 44 : 56}
              />
              <YAxis tick={tickProps(compact)} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            </>
          )}
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent active={active} payload={payload as ChartTooltipPayload} />
            )}
          />
          <Bar
            dataKey="value"
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={compact ? 22 : 36}
          >
            {chartData.map((entry, i) => (
              <Cell key={entry.name} fill={entry.fill ?? colorAt(i)} />
            ))}
            {showLabels ? (
              <LabelList
                dataKey="value"
                position={horizontal ? "right" : "top"}
                formatter={(value: number, _name: string, index: number) => {
                  const custom = labelFormatter?.(value, index);
                  if (custom) return custom;
                  return shouldShowBarLabel(value, compact) ? formatChartLabel(value) : "";
                }}
                className="fill-gray-700 dark:fill-gray-300"
                style={labelStyle(compact)}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedBarChartWidget({
  primary,
  secondary,
  primaryLabel = "Primary",
  secondaryLabel = "Secondary",
  compact,
  navPreview,
  showLabels = true,
}: ChartWidgetProps & {
  primary: ChartSeriesPoint[];
  secondary?: ChartSeriesPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const labels = primary.map((p) => p.label);
  if (!labels.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const maxLen = navPreview ? 8 : compact ? 12 : 16;
  const chartData = labels.map((label, i) => {
    const pVal = primary[i]?.value ?? 0;
    const sVal = secondary?.[i]?.value ?? 0;
    return {
      name: truncateAxisLabel(label, maxLen),
      fullName: label,
      [primaryLabel]: pVal,
      [secondaryLabel]: sVal,
      total: pVal + sVal,
    };
  });

  const margin = navPreview
    ? { top: 4, right: 4, left: 0, bottom: 0 }
    : compact
      ? BAR_CHART_MARGIN_COMPACT
      : { ...BAR_CHART_MARGIN, top: 24 };

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-gray-800" />
          <XAxis
            dataKey="name"
            tick={navPreview ? false : tickProps(compact)}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={navPreview ? 0 : -15}
            textAnchor="end"
            height={navPreview ? 0 : compact ? 44 : 56}
            hide={navPreview}
          />
          <YAxis
            tick={navPreview ? false : tickProps(compact)}
            tickLine={false}
            axisLine={false}
            width={navPreview ? 0 : 36}
            allowDecimals={false}
            hide={navPreview}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent active={active} payload={payload as ChartTooltipPayload} />
            )}
          />
          {!compact && !navPreview ? (
            <Legend wrapperStyle={CHART_LEGEND_STYLE} iconSize={CHART_LEGEND_ICON} />
          ) : null}
          <Bar dataKey={primaryLabel} stackId="a" fill={CHART_PALETTE[0]} radius={[0, 0, 0, 0]} maxBarSize={compact ? 28 : 40}>
            {!secondary && showLabels ? (
              <LabelList
                dataKey={primaryLabel}
                position="top"
                formatter={(value: number) =>
                  shouldShowBarLabel(value, compact) ? formatChartLabel(value) : ""
                }
                className="fill-gray-700 dark:fill-gray-300"
                style={labelStyle(compact)}
              />
            ) : null}
          </Bar>
          {secondary ? (
            <Bar dataKey={secondaryLabel} stackId="a" fill={CHART_PALETTE[2]} radius={[4, 4, 0, 0]} maxBarSize={compact ? 28 : 40}>
              {showLabels ? (
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(value: number) =>
                    shouldShowBarLabel(value, compact) ? formatChartLabel(value) : ""
                  }
                  className="fill-gray-700 dark:fill-gray-300"
                  style={labelStyle(compact)}
                />
              ) : null}
            </Bar>
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBarChartWidget({
  primary,
  secondary,
  primaryLabel = "Quarter",
  secondaryLabel = "YTD",
  compact,
  navPreview,
  showLabels = true,
}: ChartWidgetProps & {
  primary: ChartSeriesPoint[];
  secondary?: ChartSeriesPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const labels = primary.map((p) => p.label);
  if (!labels.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const maxLen = navPreview ? 8 : compact ? 12 : 16;
  const chartData = labels.map((label, i) => ({
    name: truncateAxisLabel(label, maxLen),
    fullName: label,
    [primaryLabel]: primary[i]?.value ?? 0,
    [secondaryLabel]: secondary?.[i]?.value ?? 0,
  }));

  const margin = navPreview
    ? { top: 4, right: 4, left: 0, bottom: 0 }
    : compact
      ? BAR_CHART_MARGIN_COMPACT
      : { ...BAR_CHART_MARGIN, top: 24 };

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={margin} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-100 dark:stroke-gray-800" />
          <XAxis
            dataKey="name"
            tick={navPreview ? false : tickProps(compact)}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={navPreview ? 0 : -15}
            textAnchor="end"
            height={navPreview ? 0 : compact ? 44 : 56}
            hide={navPreview}
          />
          <YAxis
            tick={navPreview ? false : tickProps(compact)}
            tickLine={false}
            axisLine={false}
            width={navPreview ? 0 : 36}
            allowDecimals={false}
            hide={navPreview}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent active={active} payload={payload as ChartTooltipPayload} />
            )}
          />
          {!compact && !navPreview ? (
            <Legend wrapperStyle={CHART_LEGEND_STYLE} iconSize={CHART_LEGEND_ICON} />
          ) : null}
          <Bar dataKey={primaryLabel} fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} maxBarSize={compact ? 18 : 28}>
            {showLabels ? (
              <LabelList
                dataKey={primaryLabel}
                position="top"
                formatter={(value: number) =>
                  shouldShowBarLabel(value, compact) ? formatChartLabel(value) : ""
                }
                className="fill-gray-700 dark:fill-gray-300"
                style={labelStyle(compact)}
              />
            ) : null}
          </Bar>
          {secondary ? (
            <Bar dataKey={secondaryLabel} fill={CHART_PALETTE[2]} radius={[4, 4, 0, 0]} maxBarSize={compact ? 18 : 28}>
              {showLabels ? (
                <LabelList
                  dataKey={secondaryLabel}
                  position="top"
                  formatter={(value: number) =>
                    shouldShowBarLabel(value, compact) ? formatChartLabel(value) : ""
                  }
                  className="fill-gray-700 dark:fill-gray-300"
                  style={labelStyle(compact)}
                />
              ) : null}
            </Bar>
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  index?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, value, index = 0 } = props;
  if (width < 4 || height < 4) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={colorAt(index)} stroke="#fff" strokeWidth={1} rx={3} />
      {width > 32 && height > 16 ? (
        <text x={x + 5} y={y + 16} fill="#fff" fontSize={11} fontWeight={600}>
          {name && name.length > 14 ? `${name.slice(0, 13)}…` : name}
        </text>
      ) : null}
      {width > 28 && height > 28 ? (
        <text x={x + 5} y={y + 30} fill="#fff" fontSize={10} opacity={0.95}>
          {value?.toLocaleString()}
        </text>
      ) : null}
    </g>
  );
}

export function TreemapChartWidget({
  data,
  compact,
  navPreview,
}: ChartWidgetProps & { data: ChartSeriesPoint[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const treeData = filtered.map((d) => ({ name: d.label, size: d.value }));

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={treeData} dataKey="size" aspectRatio={4 / 3} stroke="#fff" content={<TreemapContent />} />
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelChartWidget({
  data,
  compact,
  navPreview,
  showLabels = true,
}: ChartWidgetProps & { data: ChartSeriesPoint[] }) {
  const sorted = [...data].filter((d) => d.value >= 0).sort((a, b) => b.value - a.value);
  if (!sorted.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const max = Math.max(...sorted.map((d) => d.value), 1);
  const chartData = sorted.map((d, i) => ({
    name: truncateAxisLabel(d.label, compact ? 14 : 20),
    fullName: d.label,
    value: d.value,
    fill: d.color ?? colorAt(i),
  }));

  const margin = navPreview
    ? HORIZONTAL_BAR_MARGIN_NAV
    : compact
      ? HORIZONTAL_BAR_MARGIN_COMPACT
      : HORIZONTAL_BAR_MARGIN;

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={margin}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-gray-100 dark:stroke-gray-800" />
          <XAxis
            type="number"
            tick={navPreview ? false : tickProps(compact)}
            tickLine={false}
            axisLine={false}
            domain={[0, max]}
            hide={navPreview}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={navPreview ? false : tickProps(compact)}
            tickLine={false}
            axisLine={false}
            width={navPreview ? 0 : compact ? 80 : 120}
            hide={navPreview}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent active={active} payload={payload as ChartTooltipPayload} />
            )}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={compact ? 18 : 28}>
            {chartData.map((entry, i) => (
              <Cell key={entry.name} fill={entry.fill ?? colorAt(i)} />
            ))}
            {showLabels ? (
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: number) =>
                  shouldShowBarLabel(value, compact) ? formatChartLabel(value) : ""
                }
                className="fill-gray-700 dark:fill-gray-300"
                style={labelStyle(compact)}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function renderRadarValueLabel(compact?: boolean) {
  return (props: { x?: number; y?: number; value?: number }) => {
    const { x, y, value } = props;
    if (x == null || y == null || value == null || value <= 0) return null;
    return (
      <text
        x={x}
        y={y - (compact ? 4 : 6)}
        textAnchor="middle"
        className="fill-gray-700 dark:fill-gray-300"
        fontSize={compact ? 9 : 11}
        fontWeight={600}
      >
        {value.toLocaleString()}
      </text>
    );
  };
}

export function RadarChartWidget({
  data,
  compact,
  navPreview,
  showLabels = true,
}: ChartWidgetProps & { data: ChartSeriesPoint[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const max = Math.max(...filtered.map((d) => d.value), 1);
  const chartData = filtered.map((d) => ({
    subject: truncateAxisLabel(d.label, compact ? 10 : 14),
    fullName: d.label,
    value: d.value,
    fullMark: max * 1.2,
  }));

  return (
    <div style={{ height: chartHeight(compact, false, false, navPreview) }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={navPreview ? "72%" : compact ? "58%" : "70%"}>
          <PolarGrid className="stroke-gray-200 dark:stroke-gray-700" />
          <PolarAngleAxis dataKey="subject" tick={navPreview ? false : tickProps(compact)} />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <Radar
            name="Value"
            dataKey="value"
            stroke={CHART_PALETTE[0]}
            fill={CHART_PALETTE[0]}
            fillOpacity={0.35}
            label={showLabels && !navPreview ? renderRadarValueLabel(compact) : false}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent active={active} payload={payload as ChartTooltipPayload} />
            )}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HeatmapChartWidget({
  data,
  primaryLabel = "Quarter",
  secondaryLabel = "YTD",
  compact,
  navPreview,
}: ChartWidgetProps & {
  data: ChartSeriesPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  if (!data.length) return <EmptyChart compact={compact} navPreview={navPreview} />;
  const maxVal = Math.max(...data.flatMap((d) => [d.value, Number(d.meta?.ytd ?? 0)]), 1);

  const intensity = (v: number) => {
    const ratio = v / maxVal;
    return `rgba(99, 102, 241, ${0.15 + ratio * 0.75})`;
  };

  return (
    <div className={`overflow-auto ${compact ? "max-h-[140px]" : "max-h-[300px]"}`}>
      <div className="min-w-[240px]">
        <div className="mb-2 grid grid-cols-[1fr_72px_72px] gap-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span>Activity</span>
          <span className="text-right">{primaryLabel}</span>
          <span className="text-right">{secondaryLabel}</span>
        </div>
        {data.map((row) => (
          <div key={row.label} className="mb-1 grid grid-cols-[1fr_72px_72px] gap-2 px-1">
            <span className="truncate text-sm text-gray-700 dark:text-gray-300">{row.label}</span>
            <div
              className="rounded-md px-2 py-1 text-right text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100"
              style={{ backgroundColor: intensity(row.value) }}
              title={`${primaryLabel}: ${row.value}`}
            >
              {row.value.toLocaleString()}
            </div>
            <div
              className="rounded-md px-2 py-1 text-right text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100"
              style={{ backgroundColor: intensity(Number(row.meta?.ytd ?? 0)) }}
              title={`${secondaryLabel}: ${row.meta?.ytd}`}
            >
              {Number(row.meta?.ytd ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { chartHeight };
