"use client";

import React from "react";
import { Tooltip, type TooltipProps } from "recharts";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

export function ChartContainer({
  children,
  className = "",
  config,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  config?: ChartConfig;
  style?: React.CSSProperties;
}) {
  const cssVars: Record<string, string> = {};
  if (config) {
    Object.entries(config).forEach(([k, v]) => {
      cssVars[`--color-${k}`] = v.color;
    });
  }
  const styleVars: React.CSSProperties = { ...style, ...cssVars };

  return (
    <div className={`h-[280px] w-full ${className}`} style={styleVars}>
      {children}
    </div>
  );
}

export function ChartTooltip(props: TooltipProps<number, string>) {
  return <Tooltip {...props} />;
}

export function ChartTooltipContent({
  active,
  payload,
  hideLabel,
  showPercent,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  hideLabel?: boolean;
  showPercent?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const value = Number(item?.value ?? 0);
  const total = payload.reduce((sum, p) => sum + Number(p?.value ?? 0), 0);
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {!hideLabel && item?.name ? <div className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</div> : null}
      <div className="text-gray-700 dark:text-gray-300">
        {value.toLocaleString()}
        {showPercent && percent != null ? ` (${percent}%)` : ""}
      </div>
    </div>
  );
}

export function ChartFooterSummary({
  topLabel,
  topValue,
  totalLabel,
  totalValue,
}: {
  topLabel: string;
  topValue: number;
  totalLabel: string;
  totalValue: number;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
      <span>
        Top: <strong className="text-gray-800 dark:text-gray-200">{topLabel}</strong> ({topValue.toLocaleString()})
      </span>
      <span>
        {totalLabel}: <strong className="text-gray-800 dark:text-gray-200">{totalValue.toLocaleString()}</strong>
      </span>
    </div>
  );
}

