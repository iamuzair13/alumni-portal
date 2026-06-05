"use client";

import React from "react";
import type { InsightItem } from "../utils/deriveInsights";

function InsightColumn({
  title,
  items,
  variant,
  compact = false,
}: {
  title: string;
  items: InsightItem[];
  variant: "strength" | "weakness";
  compact?: boolean;
}) {
  const accent =
    variant === "strength"
      ? "border-emerald-200/80 dark:border-emerald-900/40"
      : "border-amber-200/80 dark:border-amber-900/40";
  const dot = variant === "strength" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div
      className={`rounded-xl border bg-white/80 shadow-sm backdrop-blur-sm dark:bg-gray-900/50 ${accent} ${compact ? "p-2" : "p-3"}`}
    >
      <h3 className={`font-bold uppercase tracking-wider text-gray-900 dark:text-white ${compact ? "mb-1 text-[12px]" : "mb-2 text-[11px]"}`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[12px] text-gray-400">—</p>
      ) : (
        <ul className={compact ? "space-y-1" : "space-y-2"}>
          {items.map((item) => (
            <li key={item.label} className="flex gap-1.5">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <div className="min-w-0">
                <p className={`font-semibold text-gray-800 dark:text-gray-200 ${compact ? "text-[12px] leading-tight" : "text-xs"}`}>
                  {item.label}
                </p>
                <p className={`text-gray-500 dark:text-gray-400 ${compact ? "text-[9px] leading-snug" : "text-[12px]"}`}>
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InsightsPanel({
  strengths,
  weaknesses,
  compact = false,
}: {
  strengths: InsightItem[];
  weaknesses: InsightItem[];
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 gap-3 lg:grid-cols-2"}`}>
      <InsightColumn title="Strengths" items={strengths} variant="strength" compact={compact} />
      <InsightColumn title="Areas needing attention" items={weaknesses} variant="weakness" compact={compact} />
    </div>
  );
}
