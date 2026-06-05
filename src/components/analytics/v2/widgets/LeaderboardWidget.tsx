"use client";

import React from "react";

export function LeaderboardWidget({
  title,
  items,
  limit,
  maxHeightClassName = "max-h-[280px]",
}: {
  title: string;
  items: Array<{ label: string; value: number; rank?: number }>;
  /** When set, only the top N rows are shown. Omit to show all items (scrollable). */
  limit?: number;
  maxHeightClassName?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const displayed = limit != null ? sorted.slice(0, limit) : sorted;
  const max = Math.max(...displayed.map((i) => i.value), 1);

  return (
    <div className="rounded-lg border border-gray-200/60 bg-white/60 p-2.5 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">{title}</p>
        {displayed.length > 0 ? (
          <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{displayed.length}</span>
        ) : null}
      </div>
      {displayed.length === 0 ? (
        <p className="text-xs text-gray-400">—</p>
      ) : (
        <ul className={`space-y-1.5 overflow-y-auto overscroll-contain pr-0.5 ${maxHeightClassName}`}>
          {displayed.map((item, idx) => (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
              <span className="w-4 text-[10px] font-bold text-gray-400">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200" title={item.label}>
                    {item.label}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                    {item.value.toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all dark:bg-indigo-400"
                    style={{ width: `${(item.value / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
