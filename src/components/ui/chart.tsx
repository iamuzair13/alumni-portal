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
}: {
  children: React.ReactNode;
  className?: string;
  config?: ChartConfig;
}) {
  const styleVars: React.CSSProperties & Record<string, string> = {};
  if (config) {
    Object.entries(config).forEach(([k, v]) => {
      styleVars[`--color-${k}`] = v.color;
    });
  }

  return (
    <div className={`h-[280px] w-full ${className}`} style={styleVars}>
      {children}
    </div>
  );
}

export function ChartTooltip(props: TooltipProps<number, string>) {
  return <Tooltip {...props} />;
}

export function ChartTooltipContent({ active, payload, hideLabel }: { active?: boolean; payload?: Array<{ name?: string; value?: number }>; hideLabel?: boolean }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {!hideLabel && item?.name ? <div className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</div> : null}
      <div className="text-gray-700 dark:text-gray-300">{Number(item?.value ?? 0).toLocaleString()}</div>
    </div>
  );
}

