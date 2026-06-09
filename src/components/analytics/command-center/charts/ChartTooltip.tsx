"use client";

import React from "react";
import { ChartTooltipContent } from "@/components/ui/chart";

export function CommandCenterTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { label?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1.5 text-slate-100 shadow-xl">
      {label ? <p className="mb-1 text-[10px] text-slate-400">{label}</p> : null}
      <ChartTooltipContent
        active={active}
        payload={payload as Parameters<typeof ChartTooltipContent>[0]["payload"]}
      />
    </div>
  );
}
